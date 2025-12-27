<?php
/**
 * Plugin Name: Patrick CRM Link Builder
 * Description: Secure API for automated internal link building with Elementor support
 * Version: 1.0.0
 * Author: Mehrana Agency
 * Text Domain: patrick-link-builder
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

class Patrick_Link_Builder
{

    private $version = '1.0.0';
    private $namespace = 'patrick-link-builder/v1';
    private $rate_limit_key = 'plb_rate_limit';
    private $max_requests_per_minute = 200;

    public function __construct()
    {
        add_action('rest_api_init', [$this, 'register_routes']);
        add_action('admin_menu', [$this, 'add_admin_menu']);
        add_action('admin_init', [$this, 'register_settings']);
    }

    /**
     * Register REST API routes
     */
    public function register_routes()
    {
        // Get pages with Elementor data
        register_rest_route($this->namespace, '/pages', [
            'methods' => 'GET',
            'callback' => [$this, 'get_pages'],
            'permission_callback' => [$this, 'check_permission'],
        ]);

        // Update page with links
        register_rest_route($this->namespace, '/pages/(?P<id>\d+)/apply-links', [
            'methods' => 'POST',
            'callback' => [$this, 'apply_links'],
            'permission_callback' => [$this, 'check_permission'],
            'args' => [
                'id' => [
                    'required' => true,
                    'validate_callback' => function ($param) {
                        return is_numeric($param);
                    }
                ],
                'keywords' => [
                    'required' => true,
                    'validate_callback' => function ($param) {
                        return is_array($param);
                    }
                ]
            ]
        ]);

        // Health check
        register_rest_route($this->namespace, '/health', [
            'methods' => 'GET',
            'callback' => [$this, 'health_check'],
            'permission_callback' => [$this, 'check_permission'],
        ]);

        // Debug page content
        register_rest_route($this->namespace, '/debug/(?P<id>\d+)', [
            'methods' => 'GET',
            'callback' => [$this, 'debug_page'],
            'permission_callback' => [$this, 'check_permission'],
        ]);
    }

    /**
     * Debug page content - shows all text content and widget types
     */
    public function debug_page($request)
    {
        $page_id = intval($request['id']);
        $elementor_data = get_post_meta($page_id, '_elementor_data', true);

        if (empty($elementor_data)) {
            return rest_ensure_response(['error' => 'No Elementor data']);
        }

        $data = json_decode($elementor_data, true);
        $widgets = $this->extract_widgets($data);

        return rest_ensure_response([
            'page_id' => $page_id,
            'widget_count' => count($widgets),
            'widgets' => $widgets
        ]);
    }

    /**
     * Extract all widgets with their content
     */
    private function extract_widgets($elements, $widgets = [])
    {
        foreach ($elements as $element) {
            if (isset($element['widgetType'])) {
                $widget = [
                    'type' => $element['widgetType'],
                    'settings' => []
                ];

                // Extract text content
                if (isset($element['settings']['editor'])) {
                    $widget['settings']['editor'] = substr($element['settings']['editor'], 0, 500);
                }
                if (isset($element['settings']['title'])) {
                    $widget['settings']['title'] = $element['settings']['title'];
                }
                if (isset($element['settings']['text'])) {
                    $widget['settings']['text'] = $element['settings']['text'];
                }
                if (isset($element['settings']['description'])) {
                    $widget['settings']['description'] = substr($element['settings']['description'], 0, 300);
                }

                $widgets[] = $widget;
            }

            if (isset($element['elements']) && is_array($element['elements'])) {
                $widgets = $this->extract_widgets($element['elements'], $widgets);
            }
        }
        return $widgets;
    }

    /**
     * Permission callback with security checks
     */
    public function check_permission($request)
    {
        // Check rate limiting
        if (!$this->check_rate_limit()) {
            return new WP_Error(
                'rate_limit_exceeded',
                'Too many requests. Please wait.',
                ['status' => 429]
            );
        }

        // Check if user is authenticated
        $user = wp_get_current_user();
        if (!$user || $user->ID === 0) {
            return new WP_Error(
                'rest_not_logged_in',
                'Authentication required.',
                ['status' => 401]
            );
        }

        // Check capability - must be able to edit pages
        if (!current_user_can('edit_pages')) {
            return new WP_Error(
                'rest_forbidden',
                'You do not have permission to perform this action.',
                ['status' => 403]
            );
        }

        // Check allowed origins (optional - configurable in settings)
        $allowed_origins = get_option('plb_allowed_origins', '');
        if (!empty($allowed_origins)) {
            $origin = $request->get_header('origin');
            $allowed_list = array_map('trim', explode(',', $allowed_origins));
            if (!in_array($origin, $allowed_list)) {
                $this->log('Blocked request from unauthorized origin: ' . $origin);
                return new WP_Error(
                    'rest_forbidden',
                    'Origin not allowed.',
                    ['status' => 403]
                );
            }
        }

        return true;
    }

    /**
     * Rate limiting check
     */
    private function check_rate_limit()
    {
        $transient = get_transient($this->rate_limit_key);
        $count = $transient ? intval($transient) : 0;

        if ($count >= $this->max_requests_per_minute) {
            return false;
        }

        set_transient($this->rate_limit_key, $count + 1, 60);
        return true;
    }

    /**
     * Get all pages with Elementor data
     */
    public function get_pages($request)
    {
        $args = [
            'post_type' => 'page',
            'posts_per_page' => 100,
            'post_status' => 'publish',
            'meta_query' => [
                [
                    'key' => '_elementor_data',
                    'compare' => 'EXISTS'
                ]
            ]
        ];

        $pages = get_posts($args);
        $result = [];

        foreach ($pages as $page) {
            $elementor_data = get_post_meta($page->ID, '_elementor_data', true);
            $result[] = [
                'id' => $page->ID,
                'title' => $page->post_title,
                'url' => get_permalink($page->ID),
                'elementor_data' => $elementor_data
            ];
        }

        $this->log('Fetched ' . count($result) . ' pages');

        return rest_ensure_response($result);
    }

    /**
     * Apply links to a page
     */
    public function apply_links($request)
    {
        $page_id = intval($request['id']);
        $keywords = $request['keywords'];

        // Validate page exists
        $page = get_post($page_id);
        if (!$page || $page->post_type !== 'page') {
            return new WP_Error('invalid_page', 'Page not found', ['status' => 404]);
        }

        // Get Elementor data
        $elementor_data = get_post_meta($page_id, '_elementor_data', true);
        if (empty($elementor_data)) {
            return new WP_Error('no_elementor_data', 'Page has no Elementor data', ['status' => 400]);
        }

        // Parse JSON
        $data = json_decode($elementor_data, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            return new WP_Error('invalid_json', 'Invalid Elementor data', ['status' => 400]);
        }

        // Apply links
        $results = [];
        foreach ($keywords as $kw) {
            // Sanitize inputs
            $keyword = sanitize_text_field($kw['keyword']);
            $target_url = esc_url_raw($kw['target_url']);
            $anchor_id = sanitize_html_class($kw['anchor_id']);
            $only_first = isset($kw['only_first']) ? (bool) $kw['only_first'] : true;

            if (empty($keyword) || empty($target_url)) {
                continue;
            }

            $result = $this->process_elements($data, $keyword, $target_url, $anchor_id, $only_first);
            $results[] = [
                'keyword' => $keyword,
                'count' => $result['count']
            ];
        }

        // Save updated data
        $new_data = wp_json_encode($data);
        update_post_meta($page_id, '_elementor_data', wp_slash($new_data));

        // Clear Elementor cache for this page
        if (class_exists('\Elementor\Plugin')) {
            \Elementor\Plugin::$instance->files_manager->clear_cache();
        }

        // Regenerate CSS
        delete_post_meta($page_id, '_elementor_css');

        $this->log("Applied links to page {$page_id}: " . json_encode($results));

        return rest_ensure_response([
            'success' => true,
            'page_id' => $page_id,
            'results' => $results
        ]);
    }

    /**
     * Process Elementor elements recursively - checks ALL widget types and ALL settings
     */
    private function process_elements(&$elements, $keyword, $target_url, $anchor_id, $only_first)
    {
        $total_count = 0;

        // Text-containing settings to check
        $text_fields = [
            'editor',
            'title',
            'text',
            'description',
            'content',
            'html',
            'before_text',
            'after_text',
            'item_description',
            'heading',
            'sub_title',
            'subtitle',
            'caption',
            'label'
        ];

        foreach ($elements as &$element) {
            // Process any widget type
            if (isset($element['widgetType']) && isset($element['settings'])) {
                foreach ($text_fields as $field) {
                    if (isset($element['settings'][$field]) && is_string($element['settings'][$field])) {
                        $result = $this->replace_keyword(
                            $element['settings'][$field],
                            $keyword,
                            $target_url,
                            $anchor_id,
                            $only_first && $total_count === 0
                        );
                        $element['settings'][$field] = $result['text'];
                        $total_count += $result['count'];
                    }
                }

                // Also check nested arrays in settings (like list items)
                foreach ($element['settings'] as $key => &$value) {
                    if (is_array($value)) {
                        foreach ($value as &$item) {
                            if (is_array($item)) {
                                foreach ($text_fields as $field) {
                                    if (isset($item[$field]) && is_string($item[$field])) {
                                        $result = $this->replace_keyword(
                                            $item[$field],
                                            $keyword,
                                            $target_url,
                                            $anchor_id,
                                            $only_first && $total_count === 0
                                        );
                                        $item[$field] = $result['text'];
                                        $total_count += $result['count'];
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Process nested elements
            if (isset($element['elements']) && is_array($element['elements'])) {
                $nested = $this->process_elements($element['elements'], $keyword, $target_url, $anchor_id, $only_first && $total_count === 0);
                $total_count += $nested['count'];
            }
        }

        return ['count' => $total_count];
    }

    /**
     * Replace keyword with link in text
     */
    private function replace_keyword($text, $keyword, $target_url, $anchor_id, $only_first)
    {
        if (empty($text) || !is_string($text)) {
            return ['text' => $text, 'count' => 0];
        }

        // Pattern to match keyword not already inside a link
        $escaped_kw = preg_quote($keyword, '/');
        $pattern = '/(?<!<a[^>]*>)(?<![\\w\/>])(' . $escaped_kw . ')(?![\\w<])(?![^<]*<\/a>)/iu';

        $count = 0;
        $new_text = preg_replace_callback($pattern, function ($matches) use ($target_url, $anchor_id, $only_first, &$count) {
            if ($only_first && $count > 0) {
                return $matches[0];
            }
            $count++;
            return '<a href="' . esc_url($target_url) . '" id="' . esc_attr($anchor_id) . '" class="plb-auto-link">' . esc_html($matches[1]) . '</a>';
        }, $text);

        return ['text' => $new_text, 'count' => $count];
    }

    /**
     * Health check endpoint
     */
    public function health_check($request)
    {
        return rest_ensure_response([
            'status' => 'ok',
            'version' => $this->version,
            'elementor_active' => class_exists('\Elementor\Plugin'),
            'timestamp' => current_time('mysql')
        ]);
    }

    /**
     * Log activity
     */
    private function log($message)
    {
        if (get_option('plb_enable_logging', '1') === '1') {
            $log_file = WP_CONTENT_DIR . '/plb-activity.log';
            $timestamp = current_time('mysql');
            $user = wp_get_current_user();
            $user_name = $user ? $user->user_login : 'unknown';
            $log_entry = "[{$timestamp}] [{$user_name}] {$message}\n";
            file_put_contents($log_file, $log_entry, FILE_APPEND | LOCK_EX);
        }
    }

    /**
     * Admin menu
     */
    public function add_admin_menu()
    {
        add_options_page(
            'Patrick Link Builder',
            'Patrick Link Builder',
            'manage_options',
            'patrick-link-builder',
            [$this, 'settings_page']
        );
    }

    /**
     * Register settings
     */
    public function register_settings()
    {
        register_setting('plb_settings', 'plb_allowed_origins');
        register_setting('plb_settings', 'plb_enable_logging');
    }

    /**
     * Settings page HTML
     */
    public function settings_page()
    {
        ?>
        <div class="wrap">
            <h1>Patrick Link Builder Settings</h1>
            <form method="post" action="options.php">
                <?php settings_fields('plb_settings'); ?>
                <table class="form-table">
                    <tr>
                        <th scope="row">Allowed Origins</th>
                        <td>
                            <input type="text" name="plb_allowed_origins"
                                value="<?php echo esc_attr(get_option('plb_allowed_origins')); ?>" class="regular-text" />
                            <p class="description">Comma-separated list of allowed origins (e.g., https://app.mehrana.agency).
                                Leave empty to allow all authenticated requests.</p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">Enable Logging</th>
                        <td>
                            <label>
                                <input type="checkbox" name="plb_enable_logging" value="1" <?php checked(get_option('plb_enable_logging', '1'), '1'); ?> />
                                Log all API activity to wp-content/plb-activity.log
                            </label>
                        </td>
                    </tr>
                </table>
                <?php submit_button(); ?>
            </form>

            <h2>API Information</h2>
            <table class="widefat">
                <tr>
                    <td><strong>Base URL:</strong></td>
                    <td><code><?php echo rest_url($this->namespace); ?></code></td>
                </tr>
                <tr>
                    <td><strong>Authentication:</strong></td>
                    <td>WordPress Application Passwords (Basic Auth)</td>
                </tr>
                <tr>
                    <td><strong>Endpoints:</strong></td>
                    <td>
                        <code>GET /pages</code> - Get all Elementor pages<br>
                        <code>POST /pages/{id}/apply-links</code> - Apply links to a page<br>
                        <code>GET /health</code> - Health check
                    </td>
                </tr>
            </table>
        </div>
        <?php
    }
}

// Initialize plugin
new Patrick_Link_Builder();
