
import re

file_path = 'mehrana-app.php'

# Use python to insert the Direct Upload logic SAFELY
# We will insert it AFTER "Step 2: Clear modern as3cf_items table" and BEFORE "Step 3: Force regenerate metadata"

with open(file_path, 'r') as f:
    lines = f.readlines()

new_lines = []
inserted = False

direct_upload_code = """
        // STEP 2.5: Try Direct Upload (WP Offload Media 2.6+) - WRAPPED SAFELY
        try {
            if (class_exists('DeliciousBrains\\WP_Offload_Media\\Items\\Media_Library_Item')) {
                global $as3cf;
                $this->log("[S3_REUPLOAD] Attempting DIRECT upload via Media_Library_Item");
                
                if (isset($as3cf) && is_object($as3cf) && method_exists($as3cf, 'get_item_handler')) {
                    $handler = $as3cf->get_item_handler('upload');
                    $provider = $as3cf->get_storage_provider();
                    
                    if ($handler && $provider) {
                        $item_class = 'DeliciousBrains\\WP_Offload_Media\\Items\\Media_Library_Item';
                        $new_item = new $item_class($provider->get_provider_key_name(), '', $attachment_id);
                        
                        $result = $handler->handle($new_item, ['verify_exists_in_server' => false]);
                        
                        if (!is_wp_error($result)) {
                            $this->log("[S3_REUPLOAD] Direct upload succcessful.");
                        } else {
                            $this->log("[S3_REUPLOAD] Direct upload returned error: " . $result->get_error_message());
                        }
                    } else {
                        $this->log("[S3_REUPLOAD] Could not get upload handler or provider.");
                    }
                } else {
                    $this->log("[S3_REUPLOAD] Global $as3cf not available or invalid.");
                }
            }
        } catch (\Throwable $e) {
            $this->log("[S3_REUPLOAD] Direct upload threw exception (ignoring): " . $e->getMessage());
        }
"""

for line in lines:
    new_lines.append(line)
    if "Step 2: Clear modern as3cf_items table" in line and not inserted:
        # We need to find the END of Step 2 block.
        # It ends with '}'
        pass 
    
    # Actually, let's insert it before Step 3.
    if "// STEP 3: Force regenerate metadata" in line:
        # Insert BEFORE this line
        # Remove the line we just added to append it AFTER our code
        new_lines.pop() 
        
        # Add our code
        new_lines.append(direct_upload_code)
        # Add the original line back
        new_lines.append(line)
        inserted = True

with open(file_path, 'w') as f:
    f.write(''.join(new_lines))

print("Applied Direct Upload fix.")
