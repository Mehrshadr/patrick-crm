<?php
/**
 * Plugin Name: Mehrana App Plugin
 * Description: Headless SEO & Optimization Plugin for Mehrana App - Link Building, Image Optimization & More
 * Version: 1.7.2
 * Author: Mehrana Agency
 * Author URI: https://mehrana.agency
 * Text Domain: mehrana-app
 * GitHub Plugin URI: Mehrshadr/patrick-crm
 * GitHub Branch: main
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

class Mehrana_App_Plugin
{

    private $version = '1.7.2';
    private $namespace = 'mehrana-app/v1';
    private $rate_limit_key = 'map_rate_limit';
    private $max_requests_per_minute = 200;

    // GitHub Updater Config
    private $github_username = 'Mehrshadr';
    private $github_repo = 'patrick-crm';
    private $github_plugin_path = 'wordpress-plugin/mehrana-app.php';

    public function __construct()
    {
        add_action('rest_api_init', [$this, 'register_routes']);
        add_action('admin_menu', [$this, 'add_admin_menu']);
        add_action('admin_init', [$this, 'register_settings']);

        // GitHub Auto-Update Hooks
        add_filter('pre_set_site_transient_update_plugins', [$this, 'check_for_github_update']);
        add_filter('plugins_api', [$this, 'github_plugin_info'], 20, 3);
        add_filter('upgrader_post_install', [$this, 'after_install'], 10, 3);
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
            ],
            'permission_callback' => [$this, 'check_permission'],
        ]);

        // Scan page for keywords (dry run)
        register_rest_route($this->namespace, '/pages/(?P<id>\d+)/scan', [
            'methods' => 'POST',
            'callback' => [$this, 'scan_page'],
            'permission_callback' => [$this, 'check_permission'],
        ]);
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

        // Get existing backlinks in a page
        register_rest_route($this->namespace, '/pages/(?P<id>\d+)/links', [
            'methods' => 'GET',
            'callback' => [$this, 'get_page_links'],
            'permission_callback' => [$this, 'check_permission'],
        ]);

        // Remove a specific link from page
        register_rest_route($this->namespace, '/pages/(?P<id>\d+)/links/(?P<link_id>[a-zA-Z0-9_-]+)', [
            'methods' => 'DELETE',
            'callback' => [$this, 'remove_link'],
            'permission_callback' => [$this, 'check_permission'],
        ]);

        // Get logs (for debugging)
        register_rest_route($this->namespace, '/logs', [
            'methods' => 'GET',
            'callback' => [$this, 'get_logs'],
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
     * Supports both Application Password (Basic Auth) and API Key authentication
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

        // Method 1: Check API Key authentication (simpler, no Application Password needed)
        $api_key = get_option('map_api_key', '');
        $request_key = $request->get_header('X-MAP-API-Key');

        if (!empty($api_key) && !empty($request_key) && hash_equals($api_key, $request_key)) {
            // API Key is valid - allow access
            $this->log('Authenticated via API Key');
            return true;
        }

        // Method 2: Fall back to WordPress user authentication (Application Password)
        $user = wp_get_current_user();
        if (!$user || $user->ID === 0) {
            return new WP_Error(
                'rest_not_logged_in',
                'Authentication required. Use API Key header (X-MAP-API-Key) or WordPress Application Password.',
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
        $transient_key = 'map_rate_limit_' . md5($ip);

        $current = get_transient($transient_key);
        if ($current !== false && $current >= $limit) {
            return false;
        }

        $new_count = ($current === false) ? 1 : $current + 1;
        set_transient($transient_key, $new_count, 60);

        return true;
    }

    /**
     * Get all content (pages, posts, landing pages, products, etc)
     */
    public function get_pages($request)
    {
        // Get all public post types
        $post_types = get_post_types(['public' => true], 'names');

        // Exclude internal/system types
        $exclude = ['attachment', 'elementor_library', 'elementor_font', 'elementor_icons', 'guest-author'];
        $allowed_types = array_diff(array_values($post_types), $exclude);

        $args = [
            'post_type' => array_values($allowed_types),
            'posts_per_page' => -1, // No limit
            'post_status' => 'publish',
        ];

        $pages = get_posts($args);
        $result = [];
        $debug_types = array_count_values(array_map(function ($p) {
            return $p->post_type;
        }, $pages));

        foreach ($pages as $page) {
            $elementor_data = get_post_meta($page->ID, '_elementor_data', true);

            // Determine page type
            $type = 'page';
            if ($page->post_type === 'post') {
                $type = 'blog';
            } elseif ($page->post_type !== 'page') {
                $type = $page->post_type;
            }

            $result[] = [
                'id' => $page->ID,
                'title' => $page->post_title,
                'url' => get_permalink($page->ID),
                'type' => $type,
                'has_elementor' => !empty($elementor_data),
                'elementor_data' => $elementor_data,
                'post_content' => $page->post_content
            ];
        }

        $this->log('Fetched ' . count($result) . ' pages/posts');

        return rest_ensure_response([
            'pages' => $result,
            'debug' => [
                'total_found' => count($result),
                'types_found' => $debug_types,
                'query_args' => $args
            ]
        ]);
    }

    /**
     * Apply links to a page
     */
    public function apply_links($request)
    {
        $page_id = intval($request['id']);
        $keywords = $request['keywords'];

        // Validate page exists (any public post type)
        $page = get_post($page_id);
        if (!$page || $page->post_status !== 'publish') {
            return new WP_Error('invalid_page', 'Content not found', ['status' => 404]);
        }

        $this->log("Applying links to page {$page_id}. Keywords count: " . count($keywords));

        // Get Elementor data
        $elementor_data = get_post_meta($page_id, '_elementor_data', true);

        $is_elementor = !empty($elementor_data);
        $this->log("Elementor Detection for {$page_id}: " . ($is_elementor ? 'YES' : 'NO'));
        if (!$is_elementor) {
            $raw_meta = get_post_meta($page_id, '_elementor_data'); // Get array to see if it exists but empty
            $this->log("Raw _elementor_data meta count: " . (is_array($raw_meta) ? count($raw_meta) : 'Not Array'));
            // Check if user is using Block Editor
            $has_blocks = has_blocks($page->post_content);
            $this->log("Has Gutenberg Blocks: " . ($has_blocks ? 'YES' : 'NO'));
        } else {
            $this->log("Elementor Data Length: " . strlen($elementor_data) . " chars");
        }

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
            $update_result = update_post_meta($page_id, '_elementor_data', wp_slash($new_data));

            $this->log("Elementor save result for page {$page_id}: " . ($update_result ? 'SUCCESS' : 'FAILED'));
            $this->log("Data length: " . strlen($new_data) . " bytes");

            // CRITICAL: Trigger Elementor regeneration
            // Method 1: Update edit timestamp to trigger Elementor
            update_post_meta($page_id, '_edit_last', get_current_user_id());
            update_post_meta($page_id, '_edit_lock', time() . ':' . get_current_user_id());

            // Method 2: Clear ALL Elementor caches
            if (class_exists('\Elementor\Plugin')) {
                \Elementor\Plugin::$instance->files_manager->clear_cache();
                // Also clear this specific page's cache
                delete_post_meta($page_id, '_elementor_css');
                delete_post_meta($page_id, '_elementor_page_assets');
            }

            // Method 3: Touch the post to update modification time
            wp_update_post([
                'ID' => $page_id,
                'post_modified' => current_time('mysql'),
                'post_modified_gmt' => current_time('mysql', 1)
            ]);

        } else {
            // Process Standard Content + ALL Meta Fields
            $this->log("Processing as STANDARD CONTENT (Elementor not detected or empty)");
            $content = $page->post_content;
            $all_skipped = [];
            $total_linked = 0;

            foreach ($keywords as $kw) {
                $keyword = sanitize_text_field($kw['keyword']);
                $target_url = esc_url_raw($kw['target_url']);
                $anchor_id = sanitize_html_class($kw['anchor_id']);
                $only_first = isset($kw['only_first']) ? (bool) $kw['only_first'] : true;

                if (empty($keyword) || empty($target_url))
                    continue;

                // 1. Process main post_content
                $result = $this->replace_keyword($content, $keyword, $target_url, $anchor_id, $only_first && $total_linked === 0);
                $content = $result['text'];
                $total_linked += $result['count'];

                // Collect skipped info
                if (!empty($result['skipped'])) {
                    foreach ($result['skipped'] as $skip) {
                        $skip['keyword'] = $keyword;
                        $skip['location'] = 'post_content';
                        $all_skipped[] = $skip;
                    }
                }

                // 2. Process ALL meta fields that might contain content
                $all_meta = get_post_meta($page_id);
                $content_meta_keys = $this->get_content_meta_keys($all_meta);

                foreach ($content_meta_keys as $meta_key) {
                    $meta_value = get_post_meta($page_id, $meta_key, true);
                    if (empty($meta_value) || !is_string($meta_value))
                        continue;

                    $result = $this->replace_keyword($meta_value, $keyword, $target_url, $anchor_id, $only_first && $total_linked === 0);

                    if ($result['count'] > 0) {
                        update_post_meta($page_id, $meta_key, $result['text']);
                        $total_linked += $result['count'];
                    }

                    if (!empty($result['skipped'])) {
                        foreach ($result['skipped'] as $skip) {
                            $skip['keyword'] = $keyword;
                            $skip['location'] = $meta_key;
                            $all_skipped[] = $skip;
                        }
                    }
                }

                $results[] = ['keyword' => $keyword, 'count' => $total_linked];
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
            'results' => $results,
            'skipped' => isset($all_skipped) ? $all_skipped : []
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
                if ($only_first && $total_count > 0) {
                    // Skip nested elements if limit reached
                } else {
                    $nested = $this->process_elements($element['elements'], $keyword, $target_url, $anchor_id, $only_first);
                    $total_count += $nested['count'];
                }
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
                        if ($only_first && $total_count > 0) {
                            continue;
                        }

                        $result = $this->replace_keyword(
                            $value,
                            $keyword,
                            $target_url,
                            $anchor_id,
                            $only_first
                        );
                        $value = $result['text'];
                        $total_count += $result['count'];
                    }
                } elseif (is_array($value) && !$this->is_media_object($value)) {
                    // Recurse but skip media objects
                    if ($only_first && $total_count > 0) {
                        continue;
                    }
                    $count = $this->process_settings_recursive($value, $keyword, $target_url, $anchor_id, $only_first, $depth + 1);
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
     * Get meta keys that might contain HTML/text content
     * Checks for ACF, Yoast, RankMath, WooCommerce, and custom content fields
     * @param bool $include_seo If true, also returns SEO fields (useful for cleanup/removal)
     */
    private function get_content_meta_keys($all_meta, $include_seo = false)
    {
        $content_keys = [];

        // Known content-bearing meta key patterns
        $include_patterns = [
            // ACF fields (text, textarea, wysiwyg)
            '/^_?[a-z_]+$/i',
            // WooCommerce
            '/_product_/',
            '/^_wc_/',
            // Common content fields
            '/content$/i',
            '/text$/i',
            '/excerpt$/i',
            '/bio$/i',
            '/summary$/i',
        ];

        // Keys to always exclude (not content)
        $exclude_patterns = [
            '/^_edit_/',
            '/^_wp_/',
            '/^_elementor/',
            '/^_oembed/',
            '/^_menu_/',
            '/^_thumbnail/',
            '/_hash$/',
            '/_key$/',
            '/_id$/',
            '/_token$/',
            '/^_transient/',
            '/schema$/i',
            '/json$/i',
            // SEO Fields - NEVER link build in these
            '/_yoast_wpseo_/',
            '/^rank_math_/',
            '/_metadesc$/i',
            '/_title$/i',
        ];

        // If cleaning up ($include_seo = true), DO NOT exclude SEO patterns
        if ($include_seo) {
            // Remove SEO patterns from exclude list
            $exclude_patterns = array_diff($exclude_patterns, [
                '/_yoast_wpseo_/',
                '/^rank_math_/',
                '/_metadesc$/i',
                '/_title$/i',
            ]);
        }

        // Also exclude specific keys
        $exclude_exact = [
            '_edit_lock',
            '_edit_last',
            '_wp_page_template',
            '_thumbnail_id',
            '_wp_trash_meta_time',
            '_wp_trash_meta_status'
        ];

        foreach ($all_meta as $key => $values) {
            // Skip excluded exact matches
            if (in_array($key, $exclude_exact))
                continue;

            // Skip excluded patterns
            $excluded = false;
            foreach ($exclude_patterns as $pattern) {
                if (preg_match($pattern, $key)) {
                    $excluded = true;
                    break;
                }
            }
            if ($excluded)
                continue;

            // Check if value is a string with potential HTML content
            $value = is_array($values) ? ($values[0] ?? '') : $values;
            if (!is_string($value))
                continue;
            if (strlen($value) < 10)
                continue; // Too short to contain useful content

            // Must look like HTML or plain text content (not JSON/serialized)
            if (preg_match('/^[{\["\']/', $value))
                continue; // Skip JSON-like
            if (preg_match('/^a:\d+:{/', $value))
                continue; // Skip serialized arrays

            // Include if it looks like content
            $content_keys[] = $key;
        }

        return $content_keys;
    }
    /**
     * Scan page for keywords without modifying
     */
    public function scan_page($request)
    {
        $page_id = $request['id'];
        $params = $request->get_json_params();
        $keywords = $params['keywords'] ?? []; // Array of {keyword: string}

        if (empty($keywords)) {
            return new WP_Error('no_keywords', 'No keywords provided', ['status' => 400]);
        }

        $page = get_post($page_id);
        if (!$page) {
            return new WP_Error('not_found', 'Page not found', ['status' => 404]);
        }

        $content = $page->post_content;
        $results = [];

        foreach ($keywords as $kw_data) {
            $keyword = is_array($kw_data) ? $kw_data['keyword'] : $kw_data;

            // Run dry run
            $scan_result = $this->replace_keyword(
                $content,
                $keyword,
                '', // target_url not needed
                '', // anchor_id not needed
                true, // only_first
                true  // dry_run=true
            );

            if ($scan_result['count'] > 0) {
                $results[] = [
                    'keyword' => $keyword,
                    'count' => $scan_result['count']
                ];
            }
        }

        return rest_ensure_response([
            'success' => true,
            'page_id' => $page_id,
            'candidates' => $results,
            'debug' => [
                'content_length' => strlen($content),
                'keywords_checked' => count($keywords)
            ]
        ]);
    }

    /**
     * Get all internal links (backlinks) from a page
     * Parses the page content and extracts all <a> tags with their anchor text
     */
    public function get_page_links($request)
    {
        $page_id = intval($request['id']);
        $post = get_post($page_id);

        if (!$post) {
            return new WP_Error('not_found', 'Page not found', ['status' => 404]);
        }

        $links = [];
        $site_url = home_url();

        // Get rendered content to find all visible links
        $content = apply_filters('the_content', $post->post_content);

        // Also check Elementor data (raw JSON contains link markup)
        $elementor_data = get_post_meta($page_id, '_elementor_data', true);
        if (!empty($elementor_data)) {
            if (is_string($elementor_data)) {
                $content .= $elementor_data; // Will be parsed by regex
            }
        }

        // Parse links using regex (handles both rendered and raw HTML)
        preg_match_all('/<a\s+[^>]*href=["\']([^"\']+)["\'][^>]*>(.*?)<\/a>/is', $content, $matches, PREG_SET_ORDER);

        foreach ($matches as $index => $match) {
            $url = $match[1];
            $anchor = strip_tags($match[2]);

            // Only include internal links
            if (strpos($url, $site_url) === 0 || strpos($url, '/') === 0) {
                $links[] = [
                    'id' => 'link_' . $index . '_' . md5($url . $anchor),
                    'url' => $url,
                    'anchor' => $anchor,
                    'full_html' => $match[0]
                ];
            }
        }

        return rest_ensure_response([
            'success' => true,
            'page_id' => $page_id,
            'page_url' => get_permalink($page_id),
            'links' => $links
        ]);
    }

    /**
     * Remove a specific link from page content
     * Only removes the <a> tag, keeps the anchor text
     * Fixed: Uses URL+anchor matching instead of fragile index-based IDs
     */
    public function remove_link($request)
    {
        $page_id = intval($request['id']);
        $link_id = $request['link_id'];

        $post = get_post($page_id);
        if (!$post) {
            return new WP_Error('not_found', 'Page not found', ['status' => 404]);
        }

        $site_url = home_url();
        $modified = false;

        // === STRATEGY 1: REMOVE BY HTML ID (Undo Button) ===
        // Supports removing links created by CRM with lb- IDs
        if (strpos($link_id, 'lb-') === 0) {
            $this->log("Attempting removal by HTML ID: $link_id");
            // Pattern to match specific ID <a ... id="lb-..." ...>...</a>
            $pattern_id = '/<a\s+[^>]*\bid=["\']' . preg_quote($link_id, '/') . '["\'][^>]*>(.*?)<\/a>/is';

            // 1. Post Content
            $new_content_id = preg_replace_callback($pattern_id, function ($match) use (&$modified) {
                $modified = true;
                return strip_tags($match[1]); // Return anchor text
            }, $post->post_content);

            if ($modified) {
                wp_update_post([
                    'ID' => $page_id,
                    'post_content' => $new_content_id
                ]);
                $this->log("Removed link by ID '$link_id' from post_content");
                // Refresh post object for subsequent legacy checks if needed (though we return if modified)
                $post->post_content = $new_content_id;
            }

            // 2. Elementor
            $elementor_data = get_post_meta($page_id, '_elementor_data', true);
            if (!empty($elementor_data)) {
                $data = is_string($elementor_data) ? json_decode($elementor_data, true) : $elementor_data;
                if ($data) {
                    $json_str = json_encode($data);
                    $modified_el = false;
                    // Fix: Elementor JSON has escaped quotes (id=\"...\"), so we need regex to match escaped quotes too
                    // Match id="lb-..." OR id=\"lb-...\"
                    // We use [\\\\]? before quotes to allow optional backslash
                    $pattern_id_el = '/<a\s+[^>]*\bid=[\\\\]?["\']' . preg_quote($link_id, '/') . '[\\\\]?["\'][^>]*>(.*?)<\/a>/is';

                    $new_json_str = preg_replace_callback($pattern_id_el, function ($match) use (&$modified_el) {
                        $modified_el = true;
                        return strip_tags($match[1]);
                    }, $json_str);

                    if ($modified_el) {
                        $data = json_decode($new_json_str, true);
                        update_post_meta($page_id, '_elementor_data', wp_slash(json_encode($data)));
                        $this->log("Removed link by ID '$link_id' from Elementor data");
                        $modified = true;
                    }
                }
            }

            // 3. Meta Fields
            $all_meta = get_post_meta($page_id);
            $content_meta_keys = $this->get_content_meta_keys($all_meta, true);
            foreach ($content_meta_keys as $meta_key) {
                $meta_value = get_post_meta($page_id, $meta_key, true);
                if (empty($meta_value) || !is_string($meta_value))
                    continue;

                $meta_modified = false;
                $new_meta_val = preg_replace_callback($pattern_id, function ($match) use (&$meta_modified) {
                    $meta_modified = true;
                    return strip_tags($match[1]);
                }, $meta_value);

                if ($meta_modified) {
                    update_post_meta($page_id, $meta_key, $new_meta_val);
                    $modified = true;
                    $this->log("Removed link by ID '$link_id' from meta field '$meta_key'");
                }
            }

            if ($modified) {
                return rest_ensure_response([
                    'success' => true,
                    'message' => 'Link removed successfully (by ID)'
                ]);
            }
            $this->log("ID '$link_id' not found, falling back to legacy search...");
        }

        // Use RENDERED content to find link ID (must match get_page_links logic)
        $rendered_content = apply_filters('the_content', $post->post_content);
        $elementor_data = get_post_meta($page_id, '_elementor_data', true);

        // Combined content for finding links (same as get_page_links)
        $combined_content = $rendered_content;
        if (!empty($elementor_data) && is_string($elementor_data)) {
            $combined_content .= $elementor_data;
        }

        // Pattern to match <a> tags
        $pattern = '/<a\s+[^>]*href=["\']([^"\']+)["\'][^>]*>(.*?)<\/a>/is';

        // First, find the target link by ID to get its URL and anchor
        $target_url = null;
        $target_anchor = null;

        preg_match_all($pattern, $combined_content, $matches, PREG_SET_ORDER);
        foreach ($matches as $index => $match) {
            $url = $match[1];
            $anchor = strip_tags($match[2]);
            $is_internal = (strpos($url, $site_url) === 0 || strpos($url, '/') === 0);

            if ($is_internal) {
                // Use $index (position in all matches) - same as get_page_links
                $match_id = 'link_' . $index . '_' . md5($url . $anchor);
                if ($match_id === $link_id) {
                    $target_url = $url;
                    $target_anchor = $anchor;
                    break;
                }
            }
        }

        if ($target_url === null) {
            $this->log("Link not found: $link_id in page $page_id");
            return new WP_Error('not_found', 'Link not found', ['status' => 404]);
        }

        $this->log("Found link to remove: URL=$target_url, Anchor=$target_anchor");

        // Normalize target URL for comparison (remove site_url prefix if present)
        $target_url_path = $target_url;
        if (strpos($target_url, $site_url) === 0) {
            $target_url_path = substr($target_url, strlen($site_url));
        }

        // Log for debugging
        $this->log("Searching in post_content (length: " . strlen($post->post_content) . ")");
        $this->log("Target URL path: $target_url_path, Target anchor: $target_anchor");

        // Debug: Find all links in raw post_content to see what's there
        preg_match_all($pattern, $post->post_content, $raw_matches, PREG_SET_ORDER);
        $this->log("Links found in raw post_content: " . count($raw_matches));

        // Log first 3 links found in raw content
        $debug_count = 0;
        foreach ($raw_matches as $rm) {
            if ($debug_count >= 3)
                break;
            $this->log("Raw link $debug_count: URL=" . $rm[1] . ", Anchor=" . strip_tags($rm[2]));
            $debug_count++;
        }

        // Now remove from post_content using URL+anchor matching
        $new_content = preg_replace_callback($pattern, function ($match) use ($target_url, $target_url_path, $target_anchor, $site_url, &$modified) {
            $url = $match[1];
            $anchor = strip_tags($match[2]);

            // Normalize both URLs to handle http vs https differences
            $normalized_url = preg_replace('#^https?://#', '', $url);
            $normalized_target = preg_replace('#^https?://#', '', $target_url);
            $site_domain = preg_replace('#^https?://#', '', $site_url);

            // Extract path from normalized URL
            $url_path = $url;
            if (strpos($normalized_url, $site_domain) === 0) {
                $url_path = substr($normalized_url, strlen($site_domain));
            } elseif (strpos($url, $site_url) === 0) {
                $url_path = substr($url, strlen($site_url));
            }

            // Match by normalized URL or path (handles http/https and relative URLs)
            $url_matches = ($normalized_url === $normalized_target || $url_path === $target_url_path || $url === $target_url_path);

            if ($url_matches && $anchor === $target_anchor && !$modified) {
                $modified = true;
                return strip_tags($match[2]); // Return just the anchor text without the <a> tag
            }
            return $match[0];
        }, $post->post_content);

        $this->log("Modified after post_content check: " . ($modified ? 'YES' : 'NO'));

        if ($modified) {
            // Update regular content
            wp_update_post([
                'ID' => $page_id,
                'post_content' => $new_content
            ]);
            $this->log("Removed link from post_content in page $page_id");
        } else {
            $this->log("Not found in post_content, trying Elementor data...");
            // Try in Elementor data
            if (!empty($elementor_data)) {
                $this->log("Elementor data exists (length: " . strlen($elementor_data) . ")");
                $data = is_string($elementor_data) ? json_decode($elementor_data, true) : $elementor_data;
                if ($data) {
                    $this->log("Elementor JSON parsed, searching for link...");
                    $this->remove_link_by_target($data, $target_url, $target_anchor, $modified);
                    $this->log("After Elementor search, modified: " . ($modified ? 'YES' : 'NO'));
                    if ($modified) {
                        update_post_meta($page_id, '_elementor_data', wp_slash(json_encode($data)));
                        $this->log("Removed link from Elementor data in page $page_id");
                    }
                } else {
                    $this->log("Failed to parse Elementor JSON");
                }
            } else {
                $this->log("No Elementor data found for this page");
            }
        }

        // Also check all meta fields (in case it was injected there by older version)
        if (!$modified) {
            $this->log("Not found in content/elementor, checking meta fields...");
            $all_meta = get_post_meta($page_id);
            // We use the SAME logic as we used to inject, to find where it might be
            // Note: We intentionally don't filter out SEO fields here because we want to CLEAN them
            $content_meta_keys = $this->get_content_meta_keys($all_meta, true);

            foreach ($content_meta_keys as $meta_key) {
                $meta_value = get_post_meta($page_id, $meta_key, true);
                if (empty($meta_value) || !is_string($meta_value))
                    continue;

                $meta_modified = false;
                // Use regex replace logic on meta value
                $new_meta_val = preg_replace_callback($pattern, function ($match) use ($target_url, $target_url_path, $target_anchor, $site_url, &$meta_modified) {
                    $url = $match[1];
                    $anchor = strip_tags($match[2]);

                    // Normalize (reuse match logic)
                    $normalized_url = preg_replace('#^https?://#', '', $url);
                    $normalized_target = preg_replace('#^https?://#', '', $target_url);
                    $site_domain = preg_replace('#^https?://#', '', $site_url);

                    $url_path = $url;
                    if (strpos($normalized_url, $site_domain) === 0) {
                        $url_path = substr($normalized_url, strlen($site_domain));
                    } elseif (strpos($url, $site_url) === 0) {
                        $url_path = substr($url, strlen($site_url));
                    }

                    $url_matches = ($normalized_url === $normalized_target || $url_path === $target_url_path || $url === $target_url_path);

                    if ($url_matches && $anchor === $target_anchor) {
                        $meta_modified = true;
                        return strip_tags($match[2]);
                    }
                    return $match[0];
                }, $meta_value);

                if ($meta_modified) {
                    update_post_meta($page_id, $meta_key, $new_meta_val);
                    $modified = true;
                    $this->log("Removed link from meta field '$meta_key' in page $page_id");
                }
            }
        }

        if (!$modified) {
            return new WP_Error('not_found', 'Link not found in content or meta', ['status' => 404]);
        }

        return rest_ensure_response([
            'success' => true,
            'message' => 'Link removed successfully'
        ]);
    }

    /**
     * Remove link by URL and anchor text (more reliable than index-based matching)
     */
    private function remove_link_by_target(&$data, $target_url, $target_anchor, &$modified)
    {
        $pattern = '/<a\s+[^>]*href=["\']([^"\']+)["\'][^>]*>(.*?)<\/a>/is';
        $site_url = home_url();

        // Normalize target URL
        $target_url_path = $target_url;
        if (strpos($target_url, $site_url) === 0) {
            $target_url_path = substr($target_url, strlen($site_url));
        }

        if (is_array($data)) {
            foreach ($data as $key => &$value) {
                if (is_string($value) && preg_match($pattern, $value)) {
                    $value = preg_replace_callback($pattern, function ($match) use ($target_url, $target_url_path, $target_anchor, $site_url, &$modified) {
                        $url = $match[1];
                        $anchor = strip_tags($match[2]);

                        // Normalize matched URL
                        $url_path = $url;
                        if (strpos($url, $site_url) === 0) {
                            $url_path = substr($url, strlen($site_url));
                        }

                        // Match with normalized URLs
                        if (($url === $target_url || $url_path === $target_url_path || $url === $target_url_path) && $anchor === $target_anchor && !$modified) {
                            $modified = true;
                            return strip_tags($match[2]);
                        }
                        return $match[0];
                    }, $value);
                } elseif (is_array($value)) {
                    $this->remove_link_by_target($value, $target_url, $target_anchor, $modified);
                }
            }
        }
    }

    /**
     * Recursively remove link from Elementor data (legacy, kept for compatibility)
     * @deprecated Use remove_link_by_target instead
     */
    private function remove_link_recursive(&$data, $link_id, &$modified)
    {
        $pattern = '/<a\s+[^>]*href=["\']([^"\']+)["\'][^>]*>(.*?)<\/a>/is';

        if (is_array($data)) {
            foreach ($data as $key => &$value) {
                if (is_string($value) && preg_match($pattern, $value)) {
                    $value = preg_replace_callback($pattern, function ($match) use ($link_id, &$modified) {
                        $url = $match[1];
                        $anchor = $match[2];
                        $match_id = 'link_' . $GLOBALS['_link_index'] . '_' . md5($url . strip_tags($anchor));
                        $GLOBALS['_link_index']++;

                        if ($match_id === $link_id) {
                            $modified = true;
                            return strip_tags($anchor);
                        }
                        return $match[0];
                    }, $value);
                } elseif (is_array($value)) {
                    $this->remove_link_recursive($value, $link_id, $modified);
                }
            }
        }
    }

    /**
     * Replace keyword with link in text using DOMDocument
     * Robustly handles HTML structure, excluding headings, existing links, etc.
     * @param bool $dry_run If true, only counts potential replacements without modifying text
     */
    private function replace_keyword($text, $keyword, $target_url, $anchor_id, $only_first, $dry_run = false)
    {
        $result = [
            'text' => $text,
            'count' => 0,
            'skipped' => []
        ];

        if (empty($text) || !is_string($text)) {
            return $result;
        }

        // Check if text has any HTML tags
        $has_html = $text !== strip_tags($text);

        // If simple text (no HTML), use simple replacement but safer
        if (!$has_html) {
            // Basic word boundary check for plain text
            $pattern = '/(?<![a-zA-Z\p{L}])(' . preg_quote($keyword, '/') . ')(?![a-zA-Z\p{L}])/iu';
            $count = 0;
            $new_text = preg_replace_callback($pattern, function ($matches) use ($target_url, $anchor_id, $only_first, &$count, $dry_run) {
                if ($only_first && $count > 0)
                    return $matches[0];

                $count++;

                if ($dry_run) {
                    return $matches[0];
                }

                return '<a href="' . esc_url($target_url) . '" id="' . esc_attr($anchor_id) . '" class="map-auto-link">' . $matches[1] . '</a>';
            }, $text);

            $result['text'] = $new_text;
            $result['count'] = $count;
            return $result;
        }

        // Use DOMDocument for HTML
        // Suppress warnings for malformed HTML (common in partial content)
        $dom = new DOMDocument();
        $enc_text = mb_convert_encoding($text, 'HTML-ENTITIES', 'UTF-8');
        // Wrap in a root element to handle partials correctly
        @$dom->loadHTML('<div>' . $enc_text . '</div>', LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);

        $xpath = new DOMXPath($dom);

        // Find all text nodes
        $text_nodes = $xpath->query('//text()');

        $count = 0;
        $processed_keyword = mb_strtolower($keyword, 'UTF-8');
        $skipped_nodes = [];

        // Forbidden parent tags (plus Gutenberg block comments are comments, so query('//text()') skips them automatically)
        $forbidden_tags = ['a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'b', 'script', 'style', 'textarea', 'pre', 'code', 'button', 'select', 'option'];

        $debug_stats = [
            'nodes_visited' => 0,
            'nodes_with_keyword' => 0,
            'skipped_nodes' => [],
            'regex_matches' => 0
        ];

        foreach ($text_nodes as $node) {
            $debug_stats['nodes_visited']++;
            // Check global limit including existing matches
            if ($only_first && $count > 0)
                break;

            $content = $node->nodeValue;
            if (mb_stripos($content, $keyword, 0, 'UTF-8') === false)
                continue;

            $debug_stats['nodes_with_keyword']++;

            // Check ancestry for forbidden tags
            $parent = $node->parentNode;
            $is_forbidden = false;
            while ($parent && $parent->nodeName !== 'div') { // 'div' is our wrapper
                if (in_array(strtolower($parent->nodeName), $forbidden_tags)) {
                    $is_forbidden = true;
                    // If it's an existing link, count it!
                    if (strtolower($parent->nodeName) === 'a') {
                        $count++;
                    }

                    // Log skip reason
                    $result['skipped'][] = [
                        'reason' => 'in_metadata',
                        'location' => $parent->nodeName,
                        'sample' => substr($content, 0, 60)
                    ];
                    $debug_stats['skipped_nodes'][] = "Skipped in {$parent->nodeName}";
                    break;
                }
                $parent = $parent->parentNode;
            }
            if ($is_forbidden)
                continue;

            // Double check limit after potential increment from existing link
            if ($only_first && $count > 0)
                continue;

            // Safe to link here
            // We need to split the text node and insert an element

            // Regex for case-insensitive match with word boundaries
            // Note: DOM text content doesn't have HTML tags, so safe to regex
            $pattern = '/(?<![a-zA-Z\p{L}])(' . preg_quote($keyword, '/') . ')(?![a-zA-Z\p{L}])/iu';

            if (preg_match($pattern, $content, $matches, PREG_OFFSET_CAPTURE)) {
                // Determine offset in bytes/chars carefully? 
                // preg_match returns byte offset. PHP strings are byte arrays. DOM nodeValue is UTF-8 string.
                // It's safer to use splitText but that requires index.
                // Alternative: replace the text node with a document fragment containing the link

                $frag = $dom->createDocumentFragment();

                // Split content by keyword
                // Use preg_split to capture the keyword with delimiter to keep it
                $parts = preg_split($pattern, $content, -1, PREG_SPLIT_DELIM_CAPTURE);

                foreach ($parts as $part) {
                    if (mb_strtolower($part, 'UTF-8') === $processed_keyword) {
                        // This is the keyword (or matches it insensitive)
                        // Create link
                        if ($only_first && $count > 0) {
                            $frag->appendChild($dom->createTextNode($part));
                        } else {
                            if ($dry_run) {
                                $frag->appendChild($dom->createTextNode($part));
                                $count++;
                            } else {
                                $link = $dom->createElement('a');
                                $link->setAttribute('href', $target_url);
                                $link->setAttribute('id', $anchor_id);
                                $link->setAttribute('class', 'map-auto-link');
                                $link->nodeValue = $part;
                                $frag->appendChild($link);
                                $count++;
                            }
                        }
                    } else {
                        // Regular text
                        $frag->appendChild($dom->createTextNode($part));
                    }
                }

                $node->parentNode->replaceChild($frag, $node);
            }
        }

        // Save back to HTML
        // Remove the wrapper <div>
        $body = $dom->getElementsByTagName('div')->item(0);
        $new_html = '';
        foreach ($body->childNodes as $child) {
            $new_html .= $dom->saveHTML($child);
        }

        $result['text'] = $new_html;
        $result['count'] = $count;
        // Skipped array is populated during loop

        return $result;
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
     * Get plugin logs
     */
    public function get_logs()
    {
        $log_file = WP_CONTENT_DIR . '/mehrana-app.log';
        if (!file_exists($log_file)) {
            return rest_ensure_response(['logs' => 'No log file found.']);
        }

        $content = file_get_contents($log_file);
        // Return last 2000 characters
        if (strlen($content) > 2000) {
            $content = substr($content, -2000);
        }

        return rest_ensure_response(['logs' => $content]);
    }

    /**
     * Log activity
     */
    private function log($message)
    {
        if (get_option('map_enable_logging', '1') === '1') {
            $log_file = WP_CONTENT_DIR . '/mehrana-app.log';
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
            'Mehrana App Settings',
            'Mehrana App',
            'manage_options',
            'mehrana-app',
            [$this, 'settings_page']
        );
    }

    /**
     * Register settings
     */
    public function register_settings()
    {
        register_setting('map_settings', 'map_allowed_origins');
        register_setting('map_settings', 'map_enable_logging');
        register_setting('map_settings', 'map_api_key');
    }

    /**
     * Settings page HTML
     */
    public function settings_page()
    {
        ?>
        <div class="wrap">
            <h1>Mehrana App Settings</h1>
            <form method="post" action="options.php">
                <?php settings_fields('map_settings'); ?>
                <table class="form-table">
                    <tr>
                        <th scope="row">API Key</th>
                        <td>
                            <input type="text" name="map_api_key" id="map_api_key"
                                value="<?php echo esc_attr(get_option('map_api_key')); ?>" class="regular-text" />
                            <button type="button" class="button"
                                onclick="document.getElementById('map_api_key').value = 'map_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);">Generate
                                Key</button>
                            <p class="description">
                                <strong>Recommended:</strong> Use this API Key for authentication. Send it as
                                <code>X-MAP-API-Key</code> header.<br>
                                No Application Password needed when using API Key!
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">Allowed Origins</th>
                        <td>
                            <input type="text" name="map_allowed_origins"
                                value="<?php echo esc_attr(get_option('map_allowed_origins')); ?>" class="regular-text" />
                            <p class="description">Comma-separated list of allowed origins (e.g., https://app.mehrana.agency).
                                Leave empty to allow all authenticated requests.</p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">Enable Logging</th>
                        <td>
                            <label>
                                <input type="checkbox" name="map_enable_logging" value="1" <?php checked(get_option('map_enable_logging', '1'), '1'); ?> />
                                Log all API activity to wp-content/mehrana-app.log
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
                    <td>
                        <strong>Option 1 (Recommended):</strong> API Key via <code>X-MAP-API-Key</code> header<br>
                        <strong>Option 2:</strong> WordPress Application Passwords (Basic Auth)
                    </td>
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

            <h2>Plugin Updates</h2>
            <table class="form-table">
                <tr>
                    <th scope="row">Current Version</th>
                    <td><strong><?php echo $this->version; ?></strong></td>
                </tr>
                <tr>
                    <th scope="row">Check for Updates</th>
                    <td>
                        <form method="post" style="display:inline;">
                            <?php wp_nonce_field('map_check_update', 'map_update_nonce'); ?>
                            <button type="submit" name="map_check_update" class="button button-secondary">
                                🔄 Check for Updates Now
                            </button>
                        </form>
                        <?php
                        if (isset($_POST['map_check_update']) && wp_verify_nonce($_POST['map_update_nonce'], 'map_check_update')) {
                            // Clear cache
                            delete_transient('mehrana_app_github_release');
                            delete_site_transient('update_plugins');

                            // Force check
                            wp_update_plugins();

                            echo '<p style="color: green; margin-top: 10px;">✅ Update check complete! If a new version is available, you\'ll see it on the <a href="' . admin_url('plugins.php') . '">Plugins page</a>.</p>';
                        }
                        ?>
                        <p class="description">Click to force check GitHub for plugin updates (bypasses 12-hour cache)</p>
                    </td>
                </tr>
            </table>
        </div>
        <?php
    }

    /**
     * Check GitHub for plugin updates
     * Adds update info to WordPress transient if new version available
     */
    public function check_for_github_update($transient)
    {
        if (empty($transient->checked)) {
            return $transient;
        }

        // Get plugin data
        $plugin_slug = 'mehrana-app/mehrana-app.php';

        // Check GitHub API for latest release
        $github_response = $this->get_github_release_info();

        if ($github_response && isset($github_response['tag_name'])) {
            $latest_version = ltrim($github_response['tag_name'], 'v');

            // Compare versions
            if (version_compare($this->version, $latest_version, '<')) {
                $transient->response[$plugin_slug] = (object) [
                    'slug' => 'mehrana-app',
                    'plugin' => $plugin_slug,
                    'new_version' => $latest_version,
                    'url' => "https://github.com/{$this->github_username}/{$this->github_repo}",
                    'package' => $this->get_github_download_url($github_response),
                    'tested' => '6.4',
                    'requires_php' => '7.4'
                ];
            }
        }

        return $transient;
    }

    /**
     * Provide plugin info for WordPress plugin details popup
     */
    public function github_plugin_info($result, $action, $args)
    {
        if ($action !== 'plugin_information') {
            return $result;
        }

        if (!isset($args->slug) || $args->slug !== 'mehrana-app') {
            return $result;
        }

        $github_response = $this->get_github_release_info();

        if (!$github_response) {
            return $result;
        }

        return (object) [
            'name' => 'Mehrana App Plugin',
            'slug' => 'mehrana-app',
            'version' => ltrim($github_response['tag_name'], 'v'),
            'author' => '<a href="https://mehrana.agency">Mehrana Agency</a>',
            'homepage' => "https://github.com/{$this->github_username}/{$this->github_repo}",
            'short_description' => 'Headless SEO & Optimization Plugin for Mehrana App',
            'sections' => [
                'description' => $github_response['body'] ?? 'Link Building, Image Optimization & More',
                'changelog' => $github_response['body'] ?? 'See GitHub releases for changelog'
            ],
            'download_link' => $this->get_github_download_url($github_response),
            'tested' => '6.4',
            'requires_php' => '7.4',
            'last_updated' => $github_response['published_at'] ?? ''
        ];
    }

    /**
     * Handle post-install tasks (rename folder after update)
     */
    public function after_install($response, $hook_extra, $result)
    {
        global $wp_filesystem;

        // Get plugin directory
        $plugin_folder = WP_PLUGIN_DIR . '/mehrana-app/';

        // Move files to correct location if needed
        if (isset($result['destination'])) {
            $wp_filesystem->move($result['destination'], $plugin_folder);
            $result['destination'] = $plugin_folder;
        }

        // Activate plugin
        activate_plugin('mehrana-app/mehrana-app.php');

        return $result;
    }

    /**
     * Get latest release info from GitHub API
     */
    private function get_github_release_info()
    {
        $transient_key = 'mehrana_app_github_release';
        $cached = get_transient($transient_key);

        if ($cached !== false) {
            return $cached;
        }

        $url = "https://api.github.com/repos/{$this->github_username}/{$this->github_repo}/releases/latest";

        $response = wp_remote_get($url, [
            'headers' => [
                'Accept' => 'application/vnd.github.v3+json',
                'User-Agent' => 'WordPress/' . get_bloginfo('version')
            ],
            'timeout' => 10
        ]);

        if (is_wp_error($response) || wp_remote_retrieve_response_code($response) !== 200) {
            return false;
        }

        $data = json_decode(wp_remote_retrieve_body($response), true);

        // Cache for 12 hours
        set_transient($transient_key, $data, 12 * HOUR_IN_SECONDS);

        return $data;
    }

    /**
     * Get download URL for plugin zip from GitHub release
     */
    private function get_github_download_url($release_info)
    {
        // First check for uploaded asset named mehrana-app.zip
        if (!empty($release_info['assets'])) {
            foreach ($release_info['assets'] as $asset) {
                if (strpos($asset['name'], 'mehrana-app') !== false && strpos($asset['name'], '.zip') !== false) {
                    return $asset['browser_download_url'];
                }
            }
        }

        // Fallback to raw plugin file from repo
        // Note: This won't work for full plugin, need to create release with zip asset
        return "https://github.com/{$this->github_username}/{$this->github_repo}/archive/refs/tags/{$release_info['tag_name']}.zip";
    }
}

// Initialize plugin
new Mehrana_App_Plugin();
