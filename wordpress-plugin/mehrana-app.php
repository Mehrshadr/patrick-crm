<?php
/**
 * Plugin Name: Mehrana App Plugin
 * Description: Headless SEO & Optimization Plugin for Mehrana App - Link Building, Image Optimization, GTM, Clarity & More
 * Version: 3.9.0
 * Author: Mehrana Agency
 * Author URI: https://mehrana.agency
 * Text Domain: mehrana-app
 * GitHub Plugin URI: Mehrshadr/mehrana-wordpress-plugin
 * GitHub Branch: main
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

class Mehrana_App_Plugin
{

    private $version = '3.9.0';
    private $namespace = 'mehrana/v1';
    private $rate_limit_key = 'map_rate_limit';
    private $max_requests_per_minute = 200;

    // GitHub Updater Config
    private $github_username = 'Mehrshadr';
    private $github_repo = 'mehrana-wordpress-plugin';
    private $github_plugin_path = 'mehrana-app.php';

    public function __construct()
    {
        add_action('rest_api_init', [$this, 'register_routes']);
        add_action('admin_menu', [$this, 'add_admin_menu']);
        add_action('admin_init', [$this, 'register_settings']);

        // GitHub Auto-Update Hooks
        add_filter('pre_set_site_transient_update_plugins', [$this, 'check_for_github_update']);
        add_filter('plugins_api', [$this, 'github_plugin_info'], 20, 3);
        add_filter('upgrader_post_install', [$this, 'after_install'], 10, 3);

        // Google Tag Manager Hooks
        add_action('wp_head', [$this, 'inject_gtm_head'], 1);
        add_action('wp_body_open', [$this, 'inject_gtm_body'], 1);

        // Custom Head Code Hook (for Clarity, etc.)
        add_action('wp_head', [$this, 'inject_custom_head_code'], 2);
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

        // Get media library items
        register_rest_route($this->namespace, '/media', [
            'methods' => 'GET',
            'callback' => [$this, 'get_media'],
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

        // Replace media with optimized version (creates backup first)
        register_rest_route($this->namespace, '/media/(?P<id>\d+)/replace', [
            'methods' => 'POST',
            'callback' => [$this, 'replace_media'],
            'permission_callback' => [$this, 'check_permission'],
        ]);

        // Restore media from backup
        register_rest_route($this->namespace, '/media/(?P<id>\d+)/restore', [
            'methods' => 'POST',
            'callback' => [$this, 'restore_media'],
            'permission_callback' => [$this, 'check_permission'],
        ]);

        // Delete backup file
        register_rest_route($this->namespace, '/media/(?P<id>\d+)/delete-backup', [
            'methods' => 'POST',
            'callback' => [$this, 'delete_backup'],
            'permission_callback' => [$this, 'check_permission'],
        ]);

        // Scan content for in-use images with their sizes
        register_rest_route($this->namespace, '/scan-content-images', [
            'methods' => 'GET',
            'callback' => [$this, 'scan_content_images'],
            'permission_callback' => [$this, 'check_permission'],
        ]);

        // Find media by URL
        register_rest_route($this->namespace, '/find-media', [
            'methods' => 'GET',
            'callback' => [$this, 'find_media_by_url'],
            'permission_callback' => [$this, 'check_permission'],
        ]);
    }

    /**
     * Debug page content - shows all text content and widget types
     */
    public function debug_page($request)
    {
        $page_id = intval($request['id']);
        $post = get_post($page_id);

        if (!$post) {
            return rest_ensure_response(['error' => 'Post not found']);
        }

        // Check for HTTP redirect option (query param: ?check_http=1)
        $check_http = isset($request['check_http']) && ($request['check_http'] === '1' || $request['check_http'] === 'true');

        $elementor_data = get_post_meta($page_id, '_elementor_data', true);
        $has_blocks = has_blocks($post->post_content);
        $is_wpbakery = strpos($post->post_content, '[vc_') !== false;

        // Get redirect status
        $redirect_info = $this->check_redirect($page_id, $check_http);

        $result = [
            'page_id' => $page_id,
            'title' => $post->post_title,
            'post_status' => $post->post_status,
            'content_type' => 'unknown',
            'post_content_length' => strlen($post->post_content),
            'post_content_sample' => substr($post->post_content, 0, 1000),
            'has_elementor' => !empty($elementor_data),
            'has_gutenberg_blocks' => $has_blocks,
            'has_wpbakery' => $is_wpbakery,
            'has_redirect' => $redirect_info['has_redirect'],
            'redirect_url' => $redirect_info['redirect_url'],
            'redirect_source' => $redirect_info['redirect_source'],
        ];

        // Determine content type
        if (!empty($elementor_data)) {
            $result['content_type'] = 'elementor';
            $result['elementor_data_length'] = strlen($elementor_data);
        } elseif ($is_wpbakery) {
            $result['content_type'] = 'wpbakery';
            // Extract WPBakery shortcode structure
            preg_match_all('/\[vc_([a-z_]+)\]/', $post->post_content, $shortcodes);
            $result['wpbakery_shortcodes'] = array_unique($shortcodes[1] ?? []);
        } elseif ($has_blocks) {
            $result['content_type'] = 'gutenberg';
        } else {
            $result['content_type'] = 'classic';
        }

        // Show all meta keys that might contain content
        $all_meta = get_post_meta($page_id);
        $text_meta_keys = [];
        foreach ($all_meta as $key => $values) {
            if (strpos($key, '_') === 0 && strpos($key, 'elementor') === false) {
                continue; // Skip hidden metas except elementor
            }
            foreach ($values as $v) {
                if (is_string($v) && strlen($v) > 50 && !preg_match('/^[a-z0-9]{32}$/', $v)) {
                    $text_meta_keys[$key] = strlen($v);
                }
            }
        }
        $result['content_meta_keys'] = $text_meta_keys;

        // Look for the keyword in content
        if (isset($request['keyword'])) {
            $keyword = $request['keyword'];
            $result['keyword_search'] = [
                'keyword' => $keyword,
                'found_in_post_content' => stripos($post->post_content, $keyword) !== false,
                'position_in_content' => stripos($post->post_content, $keyword)
            ];
        }

        return rest_ensure_response($result);
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
     * Check if a post has a redirect configured (Rank Math, Yoast, Redirection plugin, etc.)
     * @param int $post_id The post ID to check
     * @param bool $check_http Whether to also check via HTTP HEAD request (slower but catches all redirects)
     */
    private function check_redirect($post_id, $check_http = false)
    {
        $result = [
            'has_redirect' => false,
            'redirect_url' => null,
            'redirect_source' => null
        ];

        // 1. Check Rank Math Redirection
        $rank_math_redirect = get_post_meta($post_id, 'rank_math_redirection', true);
        if (!empty($rank_math_redirect)) {
            // Rank Math stores as array: ['url_to' => 'target', 'header_code' => 301]
            if (is_array($rank_math_redirect) && isset($rank_math_redirect['url_to'])) {
                $result['has_redirect'] = true;
                $result['redirect_url'] = $rank_math_redirect['url_to'];
                $result['redirect_source'] = 'rank_math';
                return $result;
            } elseif (is_string($rank_math_redirect)) {
                $result['has_redirect'] = true;
                $result['redirect_url'] = $rank_math_redirect;
                $result['redirect_source'] = 'rank_math';
                return $result;
            }
        }

        // 2. Check Rank Math canonical redirect (if different from post URL)
        $rank_math_canonical = get_post_meta($post_id, 'rank_math_canonical_url', true);
        if (!empty($rank_math_canonical)) {
            $post_url = get_permalink($post_id);
            if ($rank_math_canonical !== $post_url) {
                // This might indicate a redirect
                // Don't mark as redirect for now, just check actual redirect meta
            }
        }

        // 3. Check Yoast SEO Redirect
        $yoast_redirect = get_post_meta($post_id, '_yoast_wpseo_redirect', true);
        if (!empty($yoast_redirect)) {
            $result['has_redirect'] = true;
            $result['redirect_url'] = $yoast_redirect;
            $result['redirect_source'] = 'yoast';
            return $result;
        }

        // 4. Check Redirection Plugin (if installed)
        // Redirection plugin stores in its own table, but also may use post meta
        $redirection_url = get_post_meta($post_id, '_redirection_url', true);
        if (!empty($redirection_url)) {
            $result['has_redirect'] = true;
            $result['redirect_url'] = $redirection_url;
            $result['redirect_source'] = 'redirection_plugin';
            return $result;
        }

        // 5. Check Native WordPress Page Redirect
        $wp_redirect = get_post_meta($post_id, '_wp_page_redirect', true);
        if (!empty($wp_redirect)) {
            $result['has_redirect'] = true;
            $result['redirect_url'] = $wp_redirect;
            $result['redirect_source'] = 'wp_native';
            return $result;
        }

        // 6. Check SEO Press redirect
        $seopress_redirect = get_post_meta($post_id, '_seopress_redirections_enabled', true);
        if ($seopress_redirect === '1') {
            $seopress_url = get_post_meta($post_id, '_seopress_redirections_value', true);
            if (!empty($seopress_url)) {
                $result['has_redirect'] = true;
                $result['redirect_url'] = $seopress_url;
                $result['redirect_source'] = 'seopress';
                return $result;
            }
        }

        // 7. HTTP HEAD Request check (if enabled and no meta redirect found)
        if ($check_http) {
            $post_url = get_permalink($post_id);
            if ($post_url) {
                $http_result = $this->check_http_redirect($post_url);
                if ($http_result['has_redirect']) {
                    return $http_result;
                }
            }
        }

        return $result;
    }

    /**
     * Check if a URL redirects via HTTP HEAD request
     */
    private function check_http_redirect($url)
    {
        $result = [
            'has_redirect' => false,
            'redirect_url' => null,
            'redirect_source' => 'http'
        ];

        // Use wp_remote_head to make a HEAD request without following redirects
        $response = wp_remote_head($url, [
            'timeout' => 5,
            'redirection' => 0, // Don't follow redirects
            'sslverify' => false
        ]);

        if (is_wp_error($response)) {
            return $result;
        }

        $status_code = wp_remote_retrieve_response_code($response);

        // Check for redirect status codes (301, 302, 303, 307, 308)
        if (in_array($status_code, [301, 302, 303, 307, 308])) {
            $location = wp_remote_retrieve_header($response, 'location');
            if ($location) {
                $result['has_redirect'] = true;
                $result['redirect_url'] = $location;
                $result['redirect_source'] = 'http_' . $status_code;
            }
        }

        return $result;
    }

    /**
     * Get media library items
     */
    public function get_media($request)
    {
        $page = isset($request['page']) ? intval($request['page']) : 1;
        $per_page = isset($request['per_page']) ? intval($request['per_page']) : 100;
        $search = isset($request['search']) ? sanitize_text_field($request['search']) : '';
        $all = isset($request['all']) && ($request['all'] === 'true' || $request['all'] === '1');

        $args = [
            'post_type' => 'attachment',
            'post_mime_type' => 'image',
            'post_status' => 'inherit',
            'posts_per_page' => $all ? -1 : $per_page,  // -1 for all items
            'paged' => $all ? 1 : $page,
            'orderby' => 'date',
            'order' => 'DESC',
        ];

        if (!empty($search)) {
            $args['s'] = $search;
        }

        $query = new WP_Query($args);
        $result = [];

        foreach ($query->posts as $post) {
            $meta = wp_get_attachment_metadata($post->ID);
            $url = wp_get_attachment_url($post->ID);
            $file = get_attached_file($post->ID);
            $alt = get_post_meta($post->ID, '_wp_attachment_image_alt', true);

            // Get parent info
            $parent_id = $post->post_parent;
            $parent_title = '';
            $parent_type = '';
            $parent_url = '';

            if ($parent_id > 0) {
                $parent = get_post($parent_id);
                if ($parent) {
                    $parent_title = $parent->post_title;
                    $parent_type = $parent->post_type;
                    $parent_url = get_permalink($parent_id);
                }
            }

            $result[] = [
                'id' => $post->ID,
                'title' => $post->post_title,
                'filename' => basename($file),
                'alt' => $alt,
                'url' => $url,
                'width' => isset($meta['width']) ? $meta['width'] : 0,
                'height' => isset($meta['height']) ? $meta['height'] : 0,
                'filesize' => file_exists($file) ? filesize($file) : 0,
                'mime_type' => $post->post_mime_type,
                'date' => $post->post_date,
                'sizes' => isset($meta['sizes']) ? $meta['sizes'] : [],
                'parent_id' => $parent_id,
                'parent_title' => $parent_title,
                'parent_type' => $parent_type,
                'parent_url' => $parent_url
            ];
        }

        return rest_ensure_response([
            'media' => $result,
            'total' => $query->found_posts,
            'pages' => $query->max_num_pages
        ]);
    }

    /**
     * Replace media with optimized version (creates backup first)
     * Expects: base64 encoded image data
     * Supports S3 offloaded files via WP Offload Media
     */
    public function replace_media($request)
    {
        $id = intval($request['id']);
        $image_data = $request->get_param('image_data'); // base64 encoded
        $mime_type = $request->get_param('mime_type') ?: 'image/webp';

        if (!$image_data) {
            return new WP_Error('missing_data', 'Image data is required', ['status' => 400]);
        }

        // Get attachment
        $attachment = get_post($id);
        if (!$attachment || $attachment->post_type !== 'attachment') {
            return new WP_Error('invalid_id', 'Invalid attachment ID', ['status' => 404]);
        }

        // Get current file path (may not exist locally if offloaded to S3)
        $current_file = get_attached_file($id);
        $file_exists_locally = $current_file && file_exists($current_file);

        // Get upload directory for creating new/backup files
        $upload_dir = wp_upload_dir();

        // If file doesn't exist locally (S3 offload), reconstruct the path
        if (!$file_exists_locally && $current_file) {
            // Ensure directory exists
            $dir = dirname($current_file);
            if (!file_exists($dir)) {
                wp_mkdir_p($dir);
            }
        }

        // Create backup directory
        $backup_dir = $upload_dir['basedir'] . '/mehrana-backups';
        if (!file_exists($backup_dir)) {
            wp_mkdir_p($backup_dir);
            // Add .htaccess to protect backups
            file_put_contents($backup_dir . '/.htaccess', 'Options -Indexes');
        }

        // Generate backup filename
        $original_filename = $current_file ? basename($current_file) : 'attachment_' . $id . '.jpg';
        $backup_filename = date('Y-m-d_His') . '_' . $original_filename;
        $backup_path = $backup_dir . '/' . $backup_filename;

        // If file exists locally, create backup; if S3, skip backup (file is in cloud storage)
        $backup_created = false;
        if ($file_exists_locally) {
            if (copy($current_file, $backup_path)) {
                $backup_created = true;
            }
        }

        // Decode base64 and save new image
        $image_binary = base64_decode($image_data);
        if ($image_binary === false) {
            if ($backup_created)
                unlink($backup_path);
            return new WP_Error('decode_failed', 'Failed to decode image data', ['status' => 400]);
        }

        // Determine new extension based on mime type
        $new_extension = '';
        if ($mime_type === 'image/webp') {
            $new_extension = 'webp';
        } elseif ($mime_type === 'image/jpeg' || $mime_type === 'image/jpg') {
            $new_extension = 'jpg';
        } elseif ($mime_type === 'image/png') {
            $new_extension = 'png';
        }

        // Determine the new file path
        if ($current_file) {
            $path_info = pathinfo($current_file);
            if ($new_extension && $path_info['extension'] !== $new_extension) {
                $new_file = $path_info['dirname'] . '/' . $path_info['filename'] . '.' . $new_extension;
            } else {
                $new_file = $current_file;
            }
        } else {
            // Fallback: create path in current year/month folder
            $new_file = $upload_dir['path'] . '/optimized_' . $id . '.' . ($new_extension ?: 'webp');
        }

        // Ensure directory exists
        $new_dir = dirname($new_file);
        if (!file_exists($new_dir)) {
            wp_mkdir_p($new_dir);
        }

        // Write new image to local filesystem
        if (file_put_contents($new_file, $image_binary) === false) {
            if ($backup_created)
                unlink($backup_path);
            return new WP_Error('write_failed', 'Failed to write new image', ['status' => 500]);
        }

        // If extension changed, delete old file and update attachment metadata
        $old_url = wp_get_attachment_url($id);
        $old_metadata = wp_get_attachment_metadata($id);

        if ($new_file !== $current_file) {
            // Delete old thumbnails before deleting main file
            if (!empty($old_metadata['sizes'])) {
                $old_dir = dirname($current_file);
                foreach ($old_metadata['sizes'] as $size => $size_data) {
                    $thumb_path = $old_dir . '/' . $size_data['file'];
                    if (file_exists($thumb_path)) {
                        unlink($thumb_path);
                    }
                }
            }

            unlink($current_file);
            update_attached_file($id, $new_file);

            // Update mime type
            wp_update_post([
                'ID' => $id,
                'post_mime_type' => $mime_type
            ]);
        } else {
            // Same extension but still need to delete old thumbnails for regeneration
            if (!empty($old_metadata['sizes'])) {
                $old_dir = dirname($current_file);
                foreach ($old_metadata['sizes'] as $size => $size_data) {
                    $thumb_path = $old_dir . '/' . $size_data['file'];
                    if (file_exists($thumb_path)) {
                        unlink($thumb_path);
                    }
                }
            }
        }

        // Regenerate thumbnails
        require_once(ABSPATH . 'wp-admin/includes/image.php');
        $attach_data = wp_generate_attachment_metadata($id, $new_file);
        wp_update_attachment_metadata($id, $attach_data);

        // Get backup URL
        $backup_url = $upload_dir['baseurl'] . '/mehrana-backups/' . $backup_filename;

        // Get new URL
        $new_url = wp_get_attachment_url($id);
        $new_metadata = wp_get_attachment_metadata($id);

        // If extension changed, update URLs in post content
        if ($new_file !== $current_file && $old_url) {
            global $wpdb;

            // Get old filename base (without extension)
            $old_path_info = pathinfo($old_url);
            $new_path_info = pathinfo($new_url);
            $old_base = $old_path_info['dirname'] . '/' . $old_path_info['filename'];
            $new_base = $new_path_info['dirname'] . '/' . $new_path_info['filename'];
            $old_ext = '.' . $old_path_info['extension'];
            $new_ext = '.' . $new_path_info['extension'];

            // Replace main URL
            $wpdb->query($wpdb->prepare(
                "UPDATE {$wpdb->posts} SET post_content = REPLACE(post_content, %s, %s)",
                $old_url,
                $new_url
            ));

            // Replace in postmeta (Elementor, etc.)
            $wpdb->query($wpdb->prepare(
                "UPDATE {$wpdb->postmeta} SET meta_value = REPLACE(meta_value, %s, %s)",
                $old_url,
                $new_url
            ));

            // Replace thumbnail URLs (e.g., image-300x200.jpg -> image-300x200.webp)
            // We need to match pattern like: old_base-{size}.old_ext -> new_base-{size}.new_ext
            if (!empty($old_metadata['sizes'])) {
                foreach ($old_metadata['sizes'] as $size => $size_data) {
                    $old_thumb_file = $old_path_info['dirname'] . '/' . pathinfo($size_data['file'], PATHINFO_FILENAME) . $old_ext;
                    $new_thumb_file = $new_path_info['dirname'] . '/' . pathinfo($size_data['file'], PATHINFO_FILENAME) . $new_ext;

                    $wpdb->query($wpdb->prepare(
                        "UPDATE {$wpdb->posts} SET post_content = REPLACE(post_content, %s, %s)",
                        $old_thumb_file,
                        $new_thumb_file
                    ));

                    $wpdb->query($wpdb->prepare(
                        "UPDATE {$wpdb->postmeta} SET meta_value = REPLACE(meta_value, %s, %s)",
                        $old_thumb_file,
                        $new_thumb_file
                    ));
                }
            }
        }

        return rest_ensure_response([
            'success' => true,
            'backup_url' => $backup_url,
            'backup_path' => $backup_path,
            'new_url' => $new_url,
            'new_size' => filesize($new_file),
            'new_width' => $new_metadata['width'] ?? 0,
            'new_height' => $new_metadata['height'] ?? 0
        ]);
    }

    /**
     * Find media ID by URL
     */
    public function find_media_by_url($request)
    {
        $url = $request->get_param('url');

        if (!$url) {
            return new WP_Error('missing_url', 'URL parameter is required', ['status' => 400]);
        }

        // Try to find attachment by URL
        $attachment_id = attachment_url_to_postid($url);

        if ($attachment_id) {
            return rest_ensure_response([
                'success' => true,
                'media_id' => $attachment_id
            ]);
        }

        // If not found, try searching by filename in uploads
        $upload_dir = wp_upload_dir();
        $base_url = $upload_dir['baseurl'];

        // Check if URL is from this site
        if (strpos($url, $base_url) === false) {
            // Try with https/http variations
            $url_https = str_replace('http://', 'https://', $url);
            $url_http = str_replace('https://', 'http://', $url);

            $attachment_id = attachment_url_to_postid($url_https);
            if ($attachment_id) {
                return rest_ensure_response([
                    'success' => true,
                    'media_id' => $attachment_id
                ]);
            }

            $attachment_id = attachment_url_to_postid($url_http);
            if ($attachment_id) {
                return rest_ensure_response([
                    'success' => true,
                    'media_id' => $attachment_id
                ]);
            }
        }

        // Try to find by guid (sometimes works when URL has been modified)
        global $wpdb;
        $filename = basename(parse_url($url, PHP_URL_PATH));

        $attachment_id = $wpdb->get_var($wpdb->prepare(
            "SELECT ID FROM {$wpdb->posts} 
             WHERE post_type = 'attachment' 
             AND (guid LIKE %s OR post_title = %s OR post_name = %s)",
            '%' . $wpdb->esc_like($filename) . '%',
            pathinfo($filename, PATHINFO_FILENAME),
            pathinfo($filename, PATHINFO_FILENAME)
        ));

        if ($attachment_id) {
            return rest_ensure_response([
                'success' => true,
                'media_id' => intval($attachment_id)
            ]);
        }

        return rest_ensure_response([
            'success' => false,
            'error' => 'Media not found in library'
        ]);
    }

    /**
     * Restore media from backup
     */
    public function restore_media($request)
    {
        $id = intval($request['id']);
        $backup_filename = $request->get_param('backup_filename');
        $backup_path = $request->get_param('backup_path'); // Also support direct path

        // Construct backup path from filename if needed
        if ($backup_filename && !$backup_path) {
            $upload_dir = wp_upload_dir();
            $backup_path = $upload_dir['basedir'] . '/mehrana-backups/' . $backup_filename;
        }

        if (!$backup_path) {
            return new WP_Error('missing_path', 'Backup path or filename is required', ['status' => 400]);
        }

        // Validate backup exists
        if (!file_exists($backup_path)) {
            return new WP_Error('backup_not_found', 'Backup file not found: ' . $backup_path, ['status' => 404]);
        }

        // Get attachment
        $attachment = get_post($id);
        if (!$attachment || $attachment->post_type !== 'attachment') {
            return new WP_Error('invalid_id', 'Invalid attachment ID', ['status' => 404]);
        }

        // Get current file path
        $current_file = get_attached_file($id);

        // Get original extension from backup
        $backup_info = pathinfo($backup_path);
        // Backup filename format: 2024-01-05_143000_originalname.jpg
        // Extract original name by removing date prefix
        $original_name = preg_replace('/^\d{4}-\d{2}-\d{2}_\d{6}_/', '', $backup_info['basename']);
        $original_extension = pathinfo($original_name, PATHINFO_EXTENSION);

        // Restore: copy backup to original location
        $path_info = pathinfo($current_file);
        $restore_path = $path_info['dirname'] . '/' . $original_name;

        if (!copy($backup_path, $restore_path)) {
            return new WP_Error('restore_failed', 'Failed to restore from backup', ['status' => 500]);
        }

        // If current file is different (format changed), delete it
        if ($current_file !== $restore_path && file_exists($current_file)) {
            unlink($current_file);
        }

        // Update attachment file path
        update_attached_file($id, $restore_path);

        // Determine mime type from extension
        $mime_map = [
            'jpg' => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'png' => 'image/png',
            'webp' => 'image/webp',
            'gif' => 'image/gif'
        ];
        $mime_type = $mime_map[$original_extension] ?? 'image/jpeg';

        // Update post mime type
        wp_update_post([
            'ID' => $id,
            'post_mime_type' => $mime_type
        ]);

        // Regenerate thumbnails
        require_once(ABSPATH . 'wp-admin/includes/image.php');
        $attach_data = wp_generate_attachment_metadata($id, $restore_path);
        wp_update_attachment_metadata($id, $attach_data);

        // Delete backup file (cleanup)
        unlink($backup_path);

        // Get restored info
        $new_url = wp_get_attachment_url($id);
        $metadata = wp_get_attachment_metadata($id);

        return rest_ensure_response([
            'success' => true,
            'restored_url' => $new_url,
            'size' => filesize($restore_path),
            'width' => $metadata['width'] ?? 0,
            'height' => $metadata['height'] ?? 0
        ]);
    }

    /**
     * Delete backup file for an image
     */
    public function delete_backup($request)
    {
        $id = intval($request['id']);
        $backup_filename = $request->get_param('backup_filename');

        if (!$backup_filename) {
            return new WP_Error('missing_data', 'Backup filename is required', ['status' => 400]);
        }

        // Build backup path
        $upload_dir = wp_upload_dir();
        $backup_dir = $upload_dir['basedir'] . '/mehrana-backups';
        $backup_path = $backup_dir . '/' . $backup_filename;

        // Check if backup exists
        if (!file_exists($backup_path)) {
            return new WP_Error('not_found', 'Backup file not found', ['status' => 404]);
        }

        // Delete the backup file
        if (!unlink($backup_path)) {
            return new WP_Error('delete_failed', 'Failed to delete backup file', ['status' => 500]);
        }

        return rest_ensure_response([
            'success' => true,
            'message' => 'Backup deleted successfully'
        ]);
    }

    /**
     * Scan all content for in-use images and their sizes
     * This finds images that are ACTUALLY being loaded on pages
     */
    public function scan_content_images($request)
    {
        // Increase timeout for large sites
        set_time_limit(300);

        $min_size_kb = intval($request->get_param('min_size_kb')) ?: 0;
        $limit = intval($request->get_param('limit')) ?: 500; // Reduced default
        $page_num = intval($request->get_param('page')) ?: 1;
        $per_page = 50; // Process 50 posts at a time

        // Get all public post types
        $post_types = get_post_types(['public' => true], 'names');
        unset($post_types['attachment']);

        // Query published content with pagination
        $posts = get_posts([
            'post_type' => array_values($post_types),
            'post_status' => 'publish',
            'posts_per_page' => $per_page,
            'paged' => $page_num,
            'fields' => 'all'
        ]);

        $images = []; // URL => [size, pages, etc]
        $image_pages = []; // URL => [page_id, page_id, ...]

        foreach ($posts as $post) {
            // 1. Extract from post_content (Gutenberg, Classic Editor)
            $content = $post->post_content;

            // 2. Also get Elementor data if exists
            $elementor_data = get_post_meta($post->ID, '_elementor_data', true);
            if ($elementor_data) {
                $content .= ' ' . $elementor_data;
            }

            // 3. Get featured image
            $thumbnail_id = get_post_thumbnail_id($post->ID);
            if ($thumbnail_id) {
                $thumb_url = wp_get_attachment_url($thumbnail_id);
                if ($thumb_url && !isset($images[$thumb_url])) {
                    $images[$thumb_url] = null; // Will get size later
                    $image_pages[$thumb_url] = [];
                }
                if ($thumb_url) {
                    $image_pages[$thumb_url][] = $post->ID;
                }
            }

            // 4. Get WooCommerce product gallery images
            if ($post->post_type === 'product') {
                $gallery_ids = get_post_meta($post->ID, '_product_image_gallery', true);
                if ($gallery_ids) {
                    $gallery_array = explode(',', $gallery_ids);
                    foreach ($gallery_array as $gallery_id) {
                        $gallery_url = wp_get_attachment_url((int) $gallery_id);
                        if ($gallery_url) {
                            if (!isset($images[$gallery_url])) {
                                $images[$gallery_url] = null;
                                $image_pages[$gallery_url] = [];
                            }
                            if (!in_array($post->ID, $image_pages[$gallery_url])) {
                                $image_pages[$gallery_url][] = $post->ID;
                            }
                        }
                    }
                }
            }

            // Extract image URLs using regex
            // Matches: src="...", background-image: url(...), etc.
            $patterns = [
                '/src=["\']([^"\']+\.(jpg|jpeg|png|gif|webp|svg)(\?[^"\']*)?)["\']/i',
                '/data-src=["\']([^"\']+\.(jpg|jpeg|png|gif|webp)(\?[^"\']*)?)["\']/i',
                '/data-lazy-src=["\']([^"\']+\.(jpg|jpeg|png|gif|webp)(\?[^"\']*)?)["\']/i',
                '/srcset=["\']([^"\',\s]+\.(jpg|jpeg|png|gif|webp))/i',
                '/url\(["\']?([^"\')]+\.(jpg|jpeg|png|gif|webp)(\?[^"\')]*)?)["\']?\)/i',
                '/"url":\s*"([^"]+\.(jpg|jpeg|png|gif|webp))"/i',
                '/"image":\s*\{[^}]*"url":\s*"([^"]+)"/i',
                '/"background_image":\s*\{[^}]*"url":\s*"([^"]+)"/i',
            ];

            foreach ($patterns as $pattern) {
                if (preg_match_all($pattern, $content, $matches)) {
                    foreach ($matches[1] as $url) {
                        // Clean URL
                        $url = str_replace(['\\/', '\\u002F'], '/', $url);

                        // Skip external images and data URIs
                        if (strpos($url, 'data:') === 0)
                            continue;

                        // Make absolute if relative
                        if (strpos($url, 'http') !== 0) {
                            $url = home_url($url);
                        }

                        // Only include images from this site
                        $site_url = home_url();
                        if (strpos($url, $site_url) === false && strpos($url, parse_url($site_url, PHP_URL_HOST)) === false) {
                            continue;
                        }

                        if (!isset($images[$url])) {
                            $images[$url] = null;
                            $image_pages[$url] = [];
                        }
                        if (!in_array($post->ID, $image_pages[$url])) {
                            $image_pages[$url][] = $post->ID;
                        }
                    }
                }
            }
        }

        // Now get file sizes for each unique image - NO HEAD REQUESTS to avoid timeouts
        $results = [];
        foreach ($images as $url => $_) {
            $size_bytes = 0;
            $size_kb = 0;
            $real_url = $url;
            $attachment_id = null;

            // First try: Get attachment ID from URL
            $attachment_id = attachment_url_to_postid($url);
            if (!$attachment_id) {
                // Try without size suffix (e.g., -1024x768)
                $clean_url = preg_replace('/-\d+x\d+\./', '.', $url);
                $attachment_id = attachment_url_to_postid($clean_url);
            }

            if ($attachment_id) {
                // Get real URL (handles S3/CDN offload)
                $offload_url = wp_get_attachment_url($attachment_id);
                if ($offload_url) {
                    $real_url = $offload_url;
                }

                // Try attachment metadata first (fastest)
                $metadata = wp_get_attachment_metadata($attachment_id);
                if (!empty($metadata['filesize'])) {
                    $size_bytes = intval($metadata['filesize']);
                }

                // Fallback: try local file if metadata doesn't have filesize
                if (!$size_bytes) {
                    $file_path = get_attached_file($attachment_id);
                    if ($file_path && file_exists($file_path)) {
                        $size_bytes = filesize($file_path);
                    }
                }
            }

            // Final fallback: try local file path from URL
            if (!$size_bytes) {
                $upload_dir = wp_upload_dir();
                $local_path = str_replace($upload_dir['baseurl'], $upload_dir['basedir'], $url);
                if (file_exists($local_path)) {
                    $size_bytes = filesize($local_path);
                }
            }

            $size_kb = round($size_bytes / 1024, 1);

            // Only include images above threshold (or include all if size unknown)
            if ($size_kb >= $min_size_kb) {
                // Get page info
                $pages_info = [];
                foreach ($image_pages[$url] as $page_id) {
                    $pages_info[] = [
                        'id' => $page_id,
                        'title' => get_the_title($page_id),
                        'url' => get_permalink($page_id),
                        'type' => get_post_type($page_id)
                    ];
                }

                // Get alt text from media library
                $alt_text = '';
                $attachment_id = attachment_url_to_postid($url);
                if (!$attachment_id) {
                    // Try with scaled/resized variations
                    $clean_url = preg_replace('/-\d+x\d+\./', '.', $url);
                    $attachment_id = attachment_url_to_postid($clean_url);
                }
                if ($attachment_id) {
                    $alt_text = get_post_meta($attachment_id, '_wp_attachment_image_alt', true);
                    // Get real URL (handles S3 offload)
                    $real_attachment_url = wp_get_attachment_url($attachment_id);
                    if ($real_attachment_url) {
                        $url = $real_attachment_url;
                    }
                }

                $results[] = [
                    'url' => $url,
                    'filename' => basename(parse_url($url, PHP_URL_PATH)),
                    'size_bytes' => $size_bytes,
                    'size_kb' => $size_kb,
                    'alt' => $alt_text,
                    'has_alt' => !empty(trim($alt_text)),
                    'pages' => $pages_info,
                    'page_count' => count($pages_info)
                ];
            }
        }

        // Sort by size (largest first)
        usort($results, function ($a, $b) {
            return $b['size_bytes'] - $a['size_bytes'];
        });

        // Apply limit
        $results = array_slice($results, 0, $limit);

        // Get total posts count for pagination
        $total_posts_query = new WP_Query([
            'post_type' => array_values($post_types),
            'post_status' => 'publish',
            'posts_per_page' => 1,
            'fields' => 'ids'
        ]);
        $total_posts = $total_posts_query->found_posts;
        $has_more = ($page_num * $per_page) < $total_posts;

        return rest_ensure_response([
            'success' => true,
            'total_scanned' => count($images),
            'images' => $results,
            'posts_scanned' => count($posts),
            'page' => $page_num,
            'per_page' => $per_page,
            'total_posts' => $total_posts,
            'has_more' => $has_more
        ]);
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

            // Check for redirects
            $redirect_info = $this->check_redirect($page->ID);

            $result[] = [
                'id' => $page->ID,
                'title' => $page->post_title,
                'url' => get_permalink($page->ID),
                'type' => $type,
                'has_elementor' => !empty($elementor_data),
                'has_redirect' => $redirect_info['has_redirect'],
                'redirect_url' => $redirect_info['redirect_url'],
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
                $results[] = [
                    'keyword' => $keyword,
                    'count' => $result['count'],
                    'linked_count' => $result['linked_count'] ?? 0
                ];
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
            // Check if using WPBakery (Visual Composer)
            $is_wpbakery = strpos($page->post_content, '[vc_') !== false || strpos($page->post_content, '[/vc_') !== false;
            $this->log("Processing as STANDARD CONTENT (Elementor not detected or empty)");
            if ($is_wpbakery) {
                $this->log("WPBakery Page Builder detected in post_content");
            }
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

                $results[] = [
                    'keyword' => $keyword,
                    'count' => $total_linked,
                    // Note: apply_links primarily cares about applied links, but we could return linked_count if needed
                    // For now, we just stick to applied structure unless we want to track pre-existing during apply?
                    // Let's assume apply returns what it DID.
                ];
            }

            // Save Standard Content
            // Save Standard Content
            $update_result = wp_update_post([
                'ID' => $page_id,
                'post_content' => $content
            ]);

            if (is_wp_error($update_result)) {
                $this->log("Error updating post {$page_id}: " . $update_result->get_error_message());
            } elseif ($update_result === 0) {
                $this->log("Post {$page_id} update returned 0 (no changes or invalid ID)");
            } else {
                $this->log("Post {$page_id} updated successfully. Result ID: " . $update_result);

                // Clear WPBakery/Visual Composer caches if detected
                if ($is_wpbakery) {
                    // Clear WPBakery page cache
                    delete_post_meta($page_id, '_wpb_post_custom_css');
                    delete_post_meta($page_id, '_wpb_shortcodes_custom_css');
                    $this->log("Cleared WPBakery caches for post {$page_id}");
                }

                // Clear all page caches (WP Super Cache, W3TC, WP Fastest Cache, etc.)
                if (function_exists('wp_cache_clear_cache')) {
                    wp_cache_clear_cache();
                }
                if (function_exists('w3tc_flush_post')) {
                    w3tc_flush_post($page_id);
                }
                if (function_exists('wpfc_clear_post_cache_by_id')) {
                    wpfc_clear_post_cache_by_id($page_id);
                }

                // Touch post modification time
                wp_update_post([
                    'ID' => $page_id,
                    'post_modified' => current_time('mysql'),
                    'post_modified_gmt' => current_time('mysql', 1)
                ]);
            }
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
        $total_linked_count = 0;

        foreach ($elements as &$element) {
            // Process any widget type settings at any depth
            if (isset($element['settings']) && is_array($element['settings'])) {
                // Determine if we should stop based on combined count if only_first is true
                $limit_reached = $only_first && ($total_count + $total_linked_count) > 0;

                $result = $this->process_settings_recursive($element['settings'], $keyword, $target_url, $anchor_id, $only_first && !$limit_reached);
                $total_count += $result['count'];
                $total_linked_count += $result['linked_count'] ?? 0;
            }

            // Process nested elements
            if (isset($element['elements']) && is_array($element['elements'])) {
                $limit_reached = $only_first && ($total_count + $total_linked_count) > 0;

                if ($only_first && $limit_reached) {
                    // Skip nested elements if limit reached
                } else {
                    $nested = $this->process_elements($element['elements'], $keyword, $target_url, $anchor_id, $only_first);
                    $total_count += $nested['count'];
                    $total_linked_count += $nested['linked_count'] ?? 0;
                }
            }
        }

        return ['count' => $total_count, 'linked_count' => $total_linked_count];
    }

    /**
     * Process settings - recursive with BLACKLIST
     */
    private function process_settings_recursive(&$data, $keyword, $target_url, $anchor_id, $only_first, $depth = 0)
    {
        $total_count = 0;
        $total_linked_count = 0;

        // Prevent infinite recursion
        if ($depth > 10) {
            return ['count' => 0, 'linked_count' => 0];
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
                        if ($only_first && ($total_count + $total_linked_count) > 0) {
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

            if ($scan_result['count'] > 0 || ($scan_result['linked_count'] ?? 0) > 0) {
                $results[] = [
                    'keyword' => $keyword,
                    'count' => $scan_result['count'],
                    'linked_count' => $scan_result['linked_count'] ?? 0
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
            'linked_count' => 0,
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
        $dom->encoding = 'UTF-8';

        // Use XML declaration to preserve UTF-8 - DO NOT use mb_convert_encoding to HTML-ENTITIES as it breaks non-Latin chars!
        // Wrap in a root element to handle partials correctly
        libxml_use_internal_errors(true);
        $dom->loadHTML('<?xml encoding="UTF-8"><div>' . $text . '</div>', LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);
        libxml_clear_errors();

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
            if ($only_first && ($count + $result['linked_count']) > 0)
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
                    // If it's an existing link, count it as linked!
                    if (strtolower($parent->nodeName) === 'a') {
                        $result['linked_count']++; // Count as existing link
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
            if ($only_first && ($count + $result['linked_count']) > 0)
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
        register_setting('map_settings', 'map_gtm_id');
        register_setting('map_settings', 'map_custom_head_code');
    }

    /**
     * Inject GTM script into <head>
     */
    public function inject_gtm_head()
    {
        $gtm_id = get_option('map_gtm_id');
        if (empty($gtm_id)) {
            return;
        }
        ?>
        <!-- Google Tag Manager -->
        <script>(function (w, d, s, l, i) {
                w[l] = w[l] || []; w[l].push({
                    'gtm.start':
                        new Date().getTime(), event: 'gtm.js'
                }); var f = d.getElementsByTagName(s)[0],
                    j = d.createElement(s), dl = l != 'dataLayer' ? '    &l=' + l : ''; j.async = true; j.src =
                        'https://www.googletagmanager.com/gtm.js?id=' + i + dl; f.parentNode.insertBefore(j, f);
            })(window, document, 'script', 'dataLayer', '<?php echo esc_attr($gtm_id); ?>');</script>
        <!-- End Google Tag Manager -->
        <?php
    }

    /**
     * Inject GTM noscript into <body>
     */
    public function inject_gtm_body()
    {
        $gtm_id = get_option('map_gtm_id');
        if (empty($gtm_id)) {
            return;
        }
        ?>
        <!-- Google Tag Manager (noscript) -->
        <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=<?php echo esc_attr($gtm_id); ?>" height="0"
                width="0" style="display:none;visibility:hidden"></iframe></noscript>
        <!-- End Google Tag Manager (noscript) -->
        <?php
    }

    /**
     * Inject custom head code (Microsoft Clarity, etc.)
     */
    public function inject_custom_head_code()
    {
        $custom_code = get_option('map_custom_head_code');
        if (empty($custom_code)) {
            return;
        }
        // Output the custom code as-is (already contains script tags)
        echo "\n" . $custom_code . "\n";
    }

    /**
     * Settings page HTML
     */
    public function settings_page()
    {
        ?>
        <style>
            .map-settings-wrap {
                max-width: 900px;
            }

            .map-settings-wrap .map-header {
                display: flex;
                align-items: center;
                gap: 10px;
                margin-bottom: 20px;
            }

            .map-settings-wrap .map-header h1 {
                margin: 0;
                font-size: 23px;
                font-weight: 400;
            }

            .map-settings-wrap .map-header .version-badge {
                background: #0073aa;
                color: #fff;
                padding: 3px 8px;
                border-radius: 3px;
                font-size: 11px;
            }

            .map-settings-wrap .map-card {
                background: #fff;
                border: 1px solid #e0e0e0;
                border-radius: 8px;
                padding: 20px;
                margin-bottom: 20px;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
            }

            .map-settings-wrap .map-card h2 {
                margin-top: 0;
                padding-bottom: 10px;
                border-bottom: 1px solid #eee;
                color: #1e3a5f;
            }

            .map-settings-wrap .map-card h3 {
                margin: 20px 0 10px;
                color: #333;
                font-size: 14px;
            }

            .map-settings-wrap .map-field-row {
                margin-bottom: 20px;
            }

            .map-settings-wrap .map-field-row label {
                display: block;
                font-weight: 600;
                margin-bottom: 5px;
                color: #1e3a5f;
            }

            .map-settings-wrap .map-field-row .description {
                color: #666;
                font-size: 13px;
                margin-top: 5px;
            }

            .map-settings-wrap .map-field-row input[type="text"],
            .map-settings-wrap .map-field-row input[type="password"],
            .map-settings-wrap .map-field-row textarea {
                width: 100%;
                max-width: 400px;
            }

            .map-settings-wrap .map-field-row textarea {
                max-width: 100%;
                font-family: 'Courier New', monospace;
                font-size: 12px;
            }

            .map-settings-wrap .map-api-key-wrapper {
                display: flex;
                gap: 8px;
                align-items: center;
                flex-wrap: wrap;
            }

            .map-settings-wrap .map-api-key-wrapper input {
                flex: 1;
                min-width: 200px;
                max-width: 350px;
            }

            .map-settings-wrap .map-toggle-btn {
                padding: 6px 12px;
                background: #f0f0f0;
                border: 1px solid #ccc;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
            }

            .map-settings-wrap .map-toggle-btn:hover {
                background: #e0e0e0;
            }

            .map-settings-wrap .map-info-table {
                width: 100%;
                border-collapse: collapse;
            }

            .map-settings-wrap .map-info-table td {
                padding: 10px;
                border-bottom: 1px solid #eee;
                vertical-align: top;
            }

            .map-settings-wrap .map-info-table td:first-child {
                width: 150px;
                font-weight: 600;
                color: #1e3a5f;
            }

            .map-settings-wrap .map-info-table code {
                background: #f5f5f5;
                padding: 2px 6px;
                border-radius: 3px;
                font-size: 12px;
            }

            .map-settings-wrap .map-checkbox-label {
                display: flex;
                align-items: center;
                gap: 8px;
                cursor: pointer;
            }

            .map-settings-wrap .map-success-msg {
                background: #d4edda;
                color: #155724;
                padding: 10px 15px;
                border-radius: 4px;
                margin-top: 10px;
            }
        </style>

        <div class="wrap map-settings-wrap">
            <h1 class="map-header">Mehrana App <span class="version-badge">
                    <?php echo esc_html($this->version); ?>
                </span></h1>

            <form method="post" action="options.php">
                <?php settings_fields('map_settings'); ?>

                <!-- Authentication Settings -->
                <div class="map-card">
                    <h2>🔐 Authentication</h2>

                    <div class="map-field-row">
                        <label for="map_api_key">API Key</label>
                        <div class="map-api-key-wrapper">
                            <input type="password" name="map_api_key" id="map_api_key"
                                value="<?php echo esc_attr(get_option('map_api_key')); ?>"
                                placeholder="Click 'Generate Key' to create" />
                            <button type="button" class="map-toggle-btn" onclick="mapToggleApiKey()" id="map_toggle_btn"
                                title="Show/Hide API Key">👁️</button>
                            <button type="button" class="button"
                                onclick="document.getElementById('map_api_key').value = 'map_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);">🔑
                                Generate Key</button>
                        </div>
                        <p class="description">
                            <strong>Recommended:</strong> Use this API Key for authentication. Send it as
                            <code>X-MAP-API-Key</code> header.<br>
                            No Application Password needed when using API Key!
                        </p>
                    </div>

                    <div class="map-field-row">
                        <label for="map_allowed_origins">Allowed Origins</label>
                        <input type="text" name="map_allowed_origins" id="map_allowed_origins"
                            value="<?php echo esc_attr(get_option('map_allowed_origins')); ?>"
                            placeholder="https://app.example.com, https://crm.example.com" />
                        <p class="description">Comma-separated list of allowed origins. Leave empty to allow all authenticated
                            requests.</p>
                    </div>
                </div>

                <!-- Tracking & Analytics -->
                <div class="map-card">
                    <h2>📊 Tracking & Analytics</h2>

                    <div class="map-field-row">
                        <label for="map_gtm_id">Google Tag Manager ID</label>
                        <input type="text" name="map_gtm_id" id="map_gtm_id"
                            value="<?php echo esc_attr(get_option('map_gtm_id')); ?>" placeholder="GTM-XXXXXXX"
                            style="max-width: 200px;" />
                        <p class="description">
                            Enter your GTM Container ID (e.g., <code>GTM-XXXXXXX</code>).<br>
                            The GTM code will be automatically injected into all pages.
                        </p>
                    </div>

                    <div class="map-field-row">
                        <label for="map_custom_head_code">Custom Head Code</label>
                        <textarea name="map_custom_head_code" id="map_custom_head_code" rows="6"
                            placeholder="<!-- Paste your tracking code here -->"><?php echo esc_textarea(get_option('map_custom_head_code')); ?></textarea>
                        <p class="description">
                            Paste any custom tracking code here (e.g., <strong>Microsoft Clarity</strong>, <strong>Facebook
                                Pixel</strong>, <strong>Hotjar</strong>, etc.).<br>
                            This code will be injected into the <code>&lt;head&gt;</code> of all pages.
                        </p>
                    </div>
                </div>

                <!-- Advanced Settings -->
                <div class="map-card">
                    <h2>⚙️ Advanced Settings</h2>

                    <div class="map-field-row">
                        <label class="map-checkbox-label">
                            <input type="checkbox" name="map_enable_logging" value="1" <?php checked(get_option('map_enable_logging', '1'), '1'); ?> />
                            Enable API Logging
                        </label>
                        <p class="description">Log all API activity to <code>wp-content/mehrana-app.log</code> for debugging
                            purposes.</p>
                    </div>
                </div>

                <?php submit_button('Save Changes', 'primary', 'submit', true); ?>
            </form>

            <!-- API Information -->
            <div class="map-card">
                <h2>📡 API Information</h2>
                <table class="map-info-table">
                    <tr>
                        <td>Base URL</td>
                        <td><code><?php echo esc_html(rest_url($this->namespace)); ?></code></td>
                    </tr>
                    <tr>
                        <td>Authentication</td>
                        <td>
                            <strong>Option 1 (Recommended):</strong> API Key via <code>X-MAP-API-Key</code> header<br>
                            <strong>Option 2:</strong> WordPress Application Passwords (Basic Auth)
                        </td>
                    </tr>
                    <tr>
                        <td>Endpoints</td>
                        <td>
                            <code>GET /pages</code> — Get all content pages<br>
                            <code>POST /pages/{id}/apply-links</code> — Apply links to a page<br>
                            <code>POST /pages/{id}/scan</code> — Scan page for keywords<br>
                            <code>GET /pages/{id}/links</code> — Get existing backlinks<br>
                            <code>DELETE /pages/{id}/links/{link_id}</code> — Remove a backlink<br>
                            <code>GET /health</code> — Health check
                        </td>
                    </tr>
                </table>
            </div>

            <!-- Plugin Updates -->
            <div class="map-card">
                <h2>🔄 Plugin Updates</h2>
                <table class="map-info-table">
                    <tr>
                        <td>Current Version</td>
                        <td><strong>
                                <?php echo esc_html($this->version); ?>
                            </strong></td>
                    </tr>
                    <tr>
                        <td>Check for Updates</td>
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
                                $debug_info = $this->get_github_release_info(true); // Call with debug flag
                                wp_update_plugins();

                                echo '<div class="map-success-msg" style="margin-top:10px; border-left:4px solid #46b450; padding:10px; background:#fff;">';
                                echo '<strong>✅ Diagnostics Run:</strong><br>';
                                if (isset($debug_info['error'])) {
                                    echo '<span style="color:#d63638">❌ API Error: ' . esc_html($debug_info['error']) . '</span><br>';
                                    if (isset($debug_info['response_code']))
                                        echo 'Response Code: ' . $debug_info['response_code'] . '<br>';
                                    if (isset($debug_info['body']))
                                        echo 'Response Body (excerpt): ' . esc_html(substr($debug_info['body'], 0, 200)) . '...<br>';
                                } elseif (isset($debug_info['tag_name'])) {
                                    echo '<span style="color:#46b450">✅ Found Tag: ' . esc_html($debug_info['tag_name']) . '</span><br>';
                                    echo 'Latest Version: ' . ltrim($debug_info['tag_name'], 'v') . '<br>';
                                    echo 'Your Version: ' . $this->version . '<br>';
                                    if (version_compare($this->version, ltrim($debug_info['tag_name'], 'v'), '<')) {
                                        echo '<strong>🟢 Update Available!</strong> Refresh this page to see it.';
                                    } else {
                                        echo '<strong>⚪ You are on the latest version.</strong>';
                                    }
                                } else {
                                    echo '❓ Unknown Response format.';
                                }
                                echo '</div>';
                            }
                            ?>
                            <p class="description">Click to force check GitHub for plugin updates (bypasses 12-hour cache)</p>
                        </td>
                    </tr>
                </table>
            </div>
        </div>

        <script>
            function mapToggleApiKey() {
                var input = document.getElementById('map_api_key');
                var btn = document.getElementById('map_toggle_btn');
                if (input.type === 'password') {
                    input.type = 'text';
                    btn.textContent = '🙈';
                    btn.title = 'Hide API Key';
                } else {
                    input.type = 'password';
                    btn.textContent = '👁️';
                    btn.title = 'Show API Key';
                }
            }
        </script>
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
    /**
     * Get latest release info from GitHub API
     */
    private function get_github_release_info($debug = false)
    {
        $transient_key = 'mehrana_app_github_release';
        $cached = get_transient($transient_key);

        if ($cached !== false && !$debug) {
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

        if (is_wp_error($response)) {
            return $debug ? ['error' => $response->get_error_message()] : false;
        }

        $code = wp_remote_retrieve_response_code($response);
        if ($code !== 200) {
            return $debug ? [
                'error' => "HTTP $code",
                'response_code' => $code,
                'body' => wp_remote_retrieve_body($response)
            ] : false;
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
