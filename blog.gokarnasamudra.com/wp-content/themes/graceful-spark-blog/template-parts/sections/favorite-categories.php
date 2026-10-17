<?php
/**
 * Template part for Displaying favorite categories below header
 *
 * @package Graceful Spark
 */

function graceful_spark_blog_display_favorite_categories() {
    // Check if section should be displayed
    if ( ! graceful_spark_blog_options( 'favorite_categories_show' ) ) {
        return;
    }
    
    // Get section title and subtitle
    $section_title = graceful_spark_blog_options( 'favorite_categories_title' );
    
    // Get layout width
    $width_class = graceful_spark_blog_options( 'favorite_categories_width' ) === 'wrapped' ? 'max-width-container' : '';
    
    // Count how many active categories we have
    $max_slots = 4;
    $selected_categories = array();
    
    for ( $i = 1; $i <= $max_slots; $i++ ) {
        $cat_id = absint( graceful_spark_blog_options( 'favorite_category_' . $i ) );
        if ( $cat_id > 0 && term_exists( $cat_id, 'category' ) ) {
            $selected_categories[] = $cat_id;
        }
    }
    
    $count = count( $selected_categories );
    
    if ($count === 0) {
        return;
    }
    
    // Start building output
    ?>
    <div class="favorite-categories-container <?php echo esc_attr( $width_class ); ?>">
        <div class="favorite-categories-header">
            <?php if (!empty($section_title)) : ?>
                <h2 class="favorite-categories-title"><?php echo esc_html( $section_title ); ?></h2>
            <?php endif; ?>
        </div>
        
        <hr class="favorite-categories-divider">
        
        <div class="favorite-categories-grid items-<?php echo esc_attr( $count ); ?>">
            <?php
            for ( $i = 1; $i <= $max_slots; $i++ ) {
                $cat_id = absint( graceful_spark_blog_options( 'favorite_category_' . $i ) );
                
                if ( $cat_id > 0 && term_exists( $cat_id, 'category' ) ) {
                    $category = get_term( $cat_id, 'category' );
                    
                    if ( is_wp_error( $category ) ) {
                        continue;
                    }
                    
                    $cat_link = get_term_link( $category );
                    
                    if ( is_wp_error( $cat_link ) ) {
                        continue;
                    }
                    
                    $cat_name = $category->name;
                    
                    // Get image from customizer
                    $attachment_id = graceful_spark_blog_options( 'favorite_category_image_' . $i );
                    $cat_image = '';
                    
                    if ( !empty( $attachment_id ) ) {
                        $cat_image = wp_get_attachment_image_url( $attachment_id, 'full' );
                    }
                    
                    // Generate unique ID for each label based on category name
                    $label_id = sanitize_title($cat_name);
                    ?>
                    
                    <div class="favorite-category-item">
                        <a href="<?php echo esc_url( $cat_link ); ?>" class="favorite-category-link">
                            <div class="favorite-category-image-container<?php echo empty( $cat_image ) ? ' no-image' : ''; ?>">
                                <?php if ( !empty( $cat_image ) ) : ?>
                                    <img src="<?php echo esc_url( $cat_image ); ?>" alt="<?php echo esc_attr( $cat_name ); ?>" class="favorite-category-image">
                                <?php endif; ?>
                                <div class="favorite-category-label <?php echo esc_attr( $label_id ); ?>">
                                    <?php echo esc_html( strtoupper( $cat_name ) ); ?>
                                </div>
                            </div>
                        </a>
                    </div>
                    
                    <?php
                }
            }
            ?>
        </div>
    </div>
    <?php
}



/**
 * Display favorite categories if enabled
 */
if ( function_exists( 'graceful_spark_blog_display_favorite_categories' ) ) {
    graceful_spark_blog_display_favorite_categories();
}

?>
