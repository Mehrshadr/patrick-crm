<?php
/**
 * Plugin Name: Mehrana App Link Building
 * Description: Headless Link Builder for Patrick CRM - Supports Elementor & Standard Pages. Version 1.3.0 - Fixed regex pattern bug
 * Version: 1.3.0
 * Author: Mehrana Agency
 * Author URI: https://mehrana.agency
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

        // Search for keyword in page (for debugging)
        register_rest_route($this->namespace, '/search/(?P<id>\d+)', [
            'methods' => 'POST',
            'callback' => [$this, 'search_keyword'],
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
     * Search for a keyword in page content - debugging helper
     */
    public function search_keyword($request)
    {
        $page_id = intval($request['id']);
        $body = $request->get_json_params();
        $keyword = isset($body['keyword']) ? $body['keyword'] : '';

        if (empty($keyword)) {
            return rest_ensure_response(['error' => 'keyword required']);
        }

        $elementor_data = get_post_meta($page_id, '_elementor_data', true);
        $post = get_post($page_id);

        $results = [
            'page_id' => $page_id,
            'page_title' => $post ? $post->post_title : 'Unknown',
            'keyword' => $keyword,
            'found_in' => [],
            'elementor_raw_sample' => ''
        ];

        // Check post_content first
        if ($post && stripos($post->post_content, $keyword) !== false) {
            $results['found_in'][] = [
                'location' => 'post_content',
                'sample' => substr($post->post_content, max(0, stripos($post->post_content, $keyword) - 50), 150)
            ];
        }

        if (!empty($elementor_data)) {
            // Show first 500 chars of raw elementor data
            $results['elementor_raw_sample'] = substr($elementor_data, 0, 500) . '...';

            // Search in raw elementor data
            if (stripos($elementor_data, $keyword) !== false) {
                $results['found_in'][] = [
                    'location' => 'elementor_raw_data',
                    'position' => stripos($elementor_data, $keyword)
                ];
            }

            // Parse and search recursively
            $data = json_decode($elementor_data, true);
            if (is_array($data)) {
                $this->search_in_array($data, $keyword, '', $results['found_in']);
            }
        }

        $results['total_found'] = count($results['found_in']);

        return rest_ensure_response($results);
    }

    /**
     * Recursively search for keyword in array
     */
    private function search_in_array($arr, $keyword, $path, &$found)
    {
        foreach ($arr as $key => $value) {
            $current_path = $path ? "{$path}.{$key}" : $key;

            if (is_string($value) && stripos($value, $keyword) !== false) {
                $found[] = [
                    'location' => $current_path,
                    'value_length' => strlen($value),
                    'sample' => strlen($value) > 100 ? substr($value, 0, 100) . '...' : $value
                ];
            } elseif (is_array($value)) {
                $this->search_in_array($value, $keyword, $current_path, $found);
            }
        }
    }

    /**
     * Extract all widgets with their content - shows ALL string settings
     */
    private function extract_widgets($elements, $widgets = [])
    {
        foreach ($elements as $element) {
            if (isset($element['widgetType'])) {
                $widget = [
                    'type' => $element['widgetType'],
                    'settings' => []
                ];

                // Extract ALL string settings
                if (isset($element['settings']) && is_array($element['settings'])) {
                    foreach ($element['settings'] as $key => $value) {
                        if (is_string($value) && strlen($value) > 3 && strlen($value) < 500) {
                            $widget['settings'][$key] = $value;
                        }
                    }
                }

                // Only add if has any text settings
                if (!empty($widget['settings'])) {
                    $widgets[] = $widget;
                }
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
     * Rate limiting check - DISABLED FOR TESTING
     */
    private function check_rate_limit()
    {
        $limit = 200; // Requests per minute
        $ip = $_SERVER['REMOTE_ADDR'];
        $transient_key = 'plb_rate_limit_' . md5($ip);

        $current = get_transient($transient_key);
        if ($current !== false && $current >= $limit) {
            return false;
        }

        $new_count = ($current === false) ? 1 : $current + 1;
        set_transient($transient_key, $new_count, 60);

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

        $is_elementor = !empty($elementor_data);
        $results = [];

        if ($is_elementor) {
            // Process Elementor Data
            $data = json_decode($elementor_data, true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                return new WP_Error('invalid_json', 'Invalid Elementor data', ['status' => 400]);
            }

            foreach ($keywords as $kw) {
                $keyword = sanitize_text_field($kw['keyword']);
                $target_url = esc_url_raw($kw['target_url']);
                $anchor_id = sanitize_html_class($kw['anchor_id']);
                $only_first = isset($kw['only_first']) ? (bool) $kw['only_first'] : true;

                if (empty($keyword) || empty($target_url))
                    continue;

                $result = $this->process_elements($data, $keyword, $target_url, $anchor_id, $only_first);
                $results[] = ['keyword' => $keyword, 'count' => $result['count']];
            }

            // Save Elementor Data
            $new_data = wp_json_encode($data);
            update_post_meta($page_id, '_elementor_data', wp_slash($new_data));

            // Clear Elementor cache
            if (class_exists('\Elementor\Plugin')) {
                \Elementor\Plugin::$instance->files_manager->clear_cache();
            }
            delete_post_meta($page_id, '_elementor_css');

        } else {
            // Process Standard Content
            $content = $page->post_content;

            foreach ($keywords as $kw) {
                $keyword = sanitize_text_field($kw['keyword']);
                $target_url = esc_url_raw($kw['target_url']);
                $anchor_id = sanitize_html_class($kw['anchor_id']);
                $only_first = isset($kw['only_first']) ? (bool) $kw['only_first'] : true; // Default to true

                if (empty($keyword) || empty($target_url))
                    continue;

                $result = $this->replace_keyword($content, $keyword, $target_url, $anchor_id, $only_first);
                $content = $result['text'];
                $results[] = ['keyword' => $keyword, 'count' => $result['count']];
            }

            // Save Standard Content
            wp_update_post([
                'ID' => $page_id,
                'post_content' => $content
            ]);
        }

        $this->log("Applied links to page {$page_id}: " . json_encode($results));

        return rest_ensure_response([
            'success' => true,
            'page_id' => $page_id,
            'results' => $results
        ]);
    }

    /**
     * Process Elementor elements recursively - checks ALL nested settings at any depth
     */
    private function process_elements(&$elements, $keyword, $target_url, $anchor_id, $only_first)
    {
        $total_count = 0;

        foreach ($elements as &$element) {
            // Process any widget type settings at any depth
            if (isset($element['settings']) && is_array($element['settings'])) {
                $count = $this->process_settings_recursive($element['settings'], $keyword, $target_url, $anchor_id, $only_first && $total_count === 0);
                $total_count += $count;
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
     * Process settings - recursive with BLACKLIST
     */
    private function process_settings_recursive(&$data, $keyword, $target_url, $anchor_id, $only_first, $depth = 0)
    {
        $total_count = 0;

        // Prevent infinite recursion
        if ($depth > 10) {
            return 0;
        }

        // BLACKLIST: Skip fields that are definitely not content or should not contain HTML links
        // 'alt' is critical to exclude as it breaks images when containing HTML
        $blocked_endings = [
            '_id',
            '_token',
            '_url',
            '_link',
            '_src',
            '_class',
            '_css',
            'color',
            'background',
            '_size',
            '_width',
            '_height',
            'align'
        ];

        $blocked_exact = [
            'id',
            'class',
            'url',
            'link',
            'href',
            'src',
            'alt',
            'icon',
            'image',
            'thumbnail',
            'size',
            'width',
            'height',
            'view',
            'html_tag',
            'target',
            'rel',
            'video_url',
            'external_url'
        ];

        if (is_array($data)) {
            foreach ($data as $key => &$value) {
                // Check if key is blocked
                $is_blocked = false;

                if (is_string($key)) {
                    if (in_array($key, $blocked_exact)) {
                        $is_blocked = true;
                    } else {
                        foreach ($blocked_endings as $ending) {
                            if (substr($key, -strlen($ending)) === $ending) {
                                $is_blocked = true;
                                break;
                            }
                        }
                    }
                }

                if ($is_blocked) {
                    continue;
                }

                if (is_string($value) && strlen($value) > 3) {
                    // Check if contains keyword
                    if (stripos($value, $keyword) !== false) {
                        $result = $this->replace_keyword(
                            $value,
                            $keyword,
                            $target_url,
                            $anchor_id,
                            $only_first && $total_count === 0
                        );
                        $value = $result['text'];
                        $total_count += $result['count'];
                    }
                } elseif (is_array($value) && !$this->is_media_object($value)) {
                    // Recurse but skip media objects
                    $count = $this->process_settings_recursive($value, $keyword, $target_url, $anchor_id, $only_first && $total_count === 0, $depth + 1);
                    $total_count += $count;
                }
            }
        }

        return $total_count;
    }

    /**
     * Check if an array is a media object (image, icon, etc)
     */
    private function is_media_object($arr)
    {
        // Media objects typically have url, id, size keys
        return isset($arr['url']) || isset($arr['id']) || isset($arr['library']);
    }

    /**
     * Replace keyword with link in text
     */
    private function replace_keyword($text, $keyword, $target_url, $anchor_id, $only_first)
    {
        if (empty($text) || !is_string($text)) {
            return ['text' => $text, 'count' => 0];
        }

        // Escape keyword for regex
        $escaped_kw = preg_quote($keyword, '/');

        // Simple pattern - just match the keyword (case insensitive, unicode)
        $pattern = '/(' . $escaped_kw . ')/iu';

        $count = 0;
        $current_text = $text;

        $new_text = preg_replace_callback($pattern, function ($matches) use ($target_url, $anchor_id, $only_first, &$count, &$current_text) {
            // Find the position of this match in the current text
            $match_pos = stripos($current_text, $matches[0]);

            if ($match_pos === false) {
                return $matches[0];
            }

            // Check if we're inside an anchor tag
            $before = substr($current_text, 0, $match_pos);

            // Count open <a tags vs </a> tags before this position
            $open_a_count = preg_match_all('/<a\s/i', $before);
            $close_a_count = preg_match_all('/<\/a>/i', $before);

            if ($open_a_count > $close_a_count) {
                // We're inside an unclosed <a> tag, skip
                return $matches[0];
            }

            if ($only_first && $count > 0) {
                return $matches[0];
            }

            $count++;
            $replacement = '<a href="' . esc_url($target_url) . '" id="' . esc_attr($anchor_id) . '" class="plb-auto-link">' . $matches[1] . '</a>';

            // Update current_text for next iteration (mark this spot as processed)
            $current_text = substr_replace($current_text, $replacement, $match_pos, strlen($matches[0]));

            return $replacement;
        }, $text);

        // If preg_replace_callback returns null, there was an error
        if ($new_text === null) {
            error_log('[PLB] Regex error for keyword: ' . $keyword);
            return ['text' => $text, 'count' => 0];
        }

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
