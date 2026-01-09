
import re

file_path = 'mehrana-app.php'

with open(file_path, 'r') as f:
    content = f.read()

# Define the new function body
new_function = """    private function trigger_s3_reupload($attachment_id, $local_file_path, $metadata)
    {
        $this->log("[S3_REUPLOAD] Starting for attachment ID: $attachment_id, file: $local_file_path");

        global $wpdb;

        // CRITICAL FIX: WP Offload Media checks current_user_can('upload_files')
        // REST API requests via API Key run as user ID 0 (Guest), so we must switch to an admin
        $current_user_id = get_current_user_id();
        $switched_user = false;

        if ($current_user_id === 0 || !current_user_can('upload_files')) {
            $admin_user = get_users(['role' => 'administrator', 'number' => 1]);
            if (!empty($admin_user)) {
                $admin_id = $admin_user[0]->ID;
                wp_set_current_user($admin_id);
                $switched_user = true;
                $this->log("[S3_REUPLOAD] Switched to Admin User ID: $admin_id for capability check");
            } else {
                $this->log("[S3_REUPLOAD] WARNING: No administrator found. Upload might fail due to permissions.");
            }
        }

        // STEP 1: Clear legacy post_meta (WP Offload Media 1.x)
        delete_post_meta($attachment_id, 'amazonS3_info');
        delete_post_meta($attachment_id, 'as3cf_provider_object');
        $this->log("[S3_REUPLOAD] Cleared legacy post_meta");

        // STEP 2: Clear modern as3cf_items table (WP Offload Media 2.3+)
        $table_name = $wpdb->prefix . 'as3cf_items';
        if ($wpdb->get_var("SHOW TABLES LIKE '$table_name'") === $table_name) {
            $deleted = $wpdb->delete($table_name, ['source_id' => $attachment_id], ['%d']);
            $this->log("[S3_REUPLOAD] Deleted $deleted rows from as3cf_items for attachment $attachment_id");
        }

        // STEP 3: Force regenerate metadata (triggers WP Offload Media hooks)
        require_once(ABSPATH . 'wp-admin/includes/image.php');
        require_once(ABSPATH . 'wp-admin/includes/media.php');
        
        // WP Offload Media hooks into 'wp_generate_attachment_metadata' filter
        // We generate clean metadata from the local file
        $new_metadata = wp_generate_attachment_metadata($attachment_id, $local_file_path);
        
        if (!empty($new_metadata)) {
            // Apply the filter explicitly to be safe, though wp_generate_attachment_metadata does it too
            // The 'create' context is important for some plugins
            $new_metadata = apply_filters('wp_generate_attachment_metadata', $new_metadata, $attachment_id, 'create');
            
            // Save metadata - this triggers 'updated_post_meta' which WP Offload Media also watches
            wp_update_attachment_metadata($attachment_id, $new_metadata);
            $this->log("[S3_REUPLOAD] Regenerated and updated metadata");
        } else {
            $this->log("[S3_REUPLOAD] WARNING: Failed to regenerate metadata. Using fallback.");
            wp_update_attachment_metadata($attachment_id, $metadata);
        }

        // STEP 5: Additional hooks that WP Offload Media might listen to
        do_action('add_attachment', $attachment_id);
        
        // Trigger update hooks
        do_action('attachment_updated', $attachment_id, get_post($attachment_id), get_post($attachment_id));
        
        // Check if upload happened by looking for as3cf_items entry
        $check = $wpdb->get_var($wpdb->prepare(
            "SELECT id FROM {$table_name} WHERE source_id = %d LIMIT 1",
            $attachment_id
        ));
        
        if ($check) {
            $this->log("[S3_REUPLOAD] SUCCESS! as3cf_items entry created: $check");
        } else {
            $this->log("[S3_REUPLOAD] WARNING: No as3cf_items entry found after upload attempt");
            $this->log("[S3_REUPLOAD] You may need to manually offload this media from WordPress dashboard");
        }

        // Restore user if we switched
        if ($switched_user) {
            wp_set_current_user($current_user_id);
            $this->log("[S3_REUPLOAD] Restored original user ID: $current_user_id");
        }

        $this->log("[S3_REUPLOAD] Completed for attachment $attachment_id");
    }"""

# Use regex to find the function block
# Matches: private function trigger_s3_reupload ... { ... }
# Note: This simple regex assumes the function doesn't have nested braces that confuse it too much, 
# but since we know the structure (it ends before the next DocBlock /**), we can search for that.

pattern = r'(private function trigger_s3_reupload\s*\([^)]*\)\s*\{.*?\n    \})(?=\n\n    /\*\*)'
# The DOTALL flag (s) makes . match newlines
# We look for the function signature, then lazy match until `    }` followed by `\n\n    /**`

# Actually simpler: Find the start line and exact end line index
lines = content.split('\n')
start_line = -1
end_line = -1

for i, line in enumerate(lines):
    if 'private function trigger_s3_reupload' in line:
        start_line = i
    if start_line != -1 and '/**' in line and i > start_line:
        # found the next docblock
        end_line = i - 1 # the line before the docblock is likely empty, line before that is }
        break

if start_line != -1 and end_line != -1:
    print(f"Found function from line {start_line+1} to {end_line}")
    # Replace the chunk
    # Backtrack end_line to find the closing brace '    }'
    found_brace = False
    for j in range(end_line, start_line, -1):
        if lines[j].strip() == '}':
            end_line = j
            found_brace = True
            break
            
    if found_brace:
        print(f"Replacing lines {start_line+1} to {end_line+1}")
        new_lines = new_function.split('\n')
        
        # Keep lines before start
        final_lines = lines[:start_line]
        # Add new function
        final_lines.extend(new_lines)
        # Add lines after end
        final_lines.extend(lines[end_line+1:])
        
        with open(file_path, 'w') as f:
            f.write('\n'.join(final_lines))
        print("File updated successfully.")
    else:
        print("Could not find closing brace.")
else:
    print("Could not find function bounds.")
