<?php
/**
 * Graceful Spark Blog Posts Carousel Slider Component
 *
 * @package Graceful Spark Blog
 */

function gracefulspark_blog_carousel_get_category_class( $category_slug ) {
    $category_styles = array(
        'training'  => 'gracefulspark-category-training',
        'workout'   => 'gracefulspark-category-workout',
        'nutrition' => 'gracefulspark-category-nutrition',
        'fitness'   => 'gracefulspark-category-workout',
        'diet'      => 'gracefulspark-category-nutrition',
        'exercise'  => 'gracefulspark-category-workout',
    );

    return isset( $category_styles[ $category_slug ] ) ? $category_styles[ $category_slug ] : 'gracefulspark-category-default';
}

/**
 * Render blog carousel post card
 */
function gracefulspark_blog_carousel_render_post_card( $post ) {
    if ( ! $post instanceof WP_Post ) {
        return;
    }

    $post_id        = absint( $post->ID );
    $post_title     = get_the_title( $post_id );
    $post_permalink = get_permalink( $post_id );
    $post_thumbnail = get_the_post_thumbnail_url( $post_id, 'medium' );
    $post_categories = get_the_category( $post_id );
    $author_id      = absint( $post->post_author );
    $author_name    = get_the_author_meta( 'display_name', $author_id );
    $author_avatar  = get_avatar_url( $author_id, array( 'size' => 80 ) );

    // Determine category class for badge styling.
    $category_class = 'gracefulspark-category-default';
    $category_name  = esc_html__( 'General', 'graceful-spark-blog' );

    if ( ! empty( $post_categories ) && is_array( $post_categories ) ) {
        $primary_category = $post_categories[0];
        if ( $primary_category instanceof WP_Term ) {
            $category_name  = $primary_category->name;
            $category_slug  = $primary_category->slug;
            $category_class = gracefulspark_blog_carousel_get_category_class( $category_slug );
        }
    }

    // Ensure we have valid data before rendering.
    if ( empty( $post_title ) || empty( $post_permalink ) ) {
        return;
    }
    ?>

    <div class="gracefulspark-blog-post-card">
        <div class="gracefulspark-card-image">
            <?php if ( $post_thumbnail ) : ?>
                <img src="<?php echo esc_url( $post_thumbnail ); ?>" 
                     alt="<?php echo esc_attr( $post_title ); ?>" 
                     loading="lazy">
            <?php else : ?>
                <div class="gracefulspark-placeholder-image">
                    <?php esc_html_e( 'No Image Available', 'graceful-spark-blog' ); ?>
                </div>
            <?php endif; ?>

            <div class="gracefulspark-category-badge <?php echo esc_attr( $category_class ); ?>">
                <?php echo esc_html( strtoupper( $category_name ) ); ?>
            </div>
        </div>

        <div class="gracefulspark-card-content">
            <h3 class="gracefulspark-card-title">
                <a href="<?php echo esc_url( $post_permalink ); ?>" 
                    <?php // translators: %s is the post title. ?>
                   title="<?php echo esc_attr( sprintf( __( 'Read more about %s', 'graceful-spark-blog' ), $post_title ) ); ?>">
                    <?php echo esc_html( $post_title ); ?>
                </a>
            </h3>

            <div class="gracefulspark-author-info">
                <img src="<?php echo esc_url( $author_avatar ); ?>" 
                     <?php // translators: %s is the author name. ?>
                     alt="<?php echo esc_attr( sprintf( __( 'Avatar for %s', 'graceful-spark-blog' ), $author_name ) ); ?>" 
                     class="gracefulspark-author-avatar" 
                     loading="lazy">
                <div class="gracefulspark-author-details">
                    <div class="gracefulspark-author-label">
                        <?php esc_html_e( 'Written by', 'graceful-spark-blog' ); ?>
                    </div>
                    <div class="gracefulspark-author-name">
                        <?php echo esc_html( $author_name ); ?>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <?php
}

// Hook the enqueue function.
add_action( 'wp_enqueue_scripts', 'gracefulspark_blog_carousel_enqueue_assets' );

// Get latest blog posts with proper error handling.
$gracefulspark_carousel_posts_args = array(
    'numberposts' => 5,
    'post_status' => 'publish',
    'post_type'   => 'post',
    'orderby'     => 'date',
    'order'       => 'DESC',
);

$gracefulspark_carousel_posts = get_posts( $gracefulspark_carousel_posts_args );

if ( empty( $gracefulspark_carousel_posts ) || ! is_array( $gracefulspark_carousel_posts ) ) {
    return;
}
?>

<section id="gracefulspark-blog-carousel-section" role="region" aria-label="<?php esc_attr_e( 'Latest blog posts carousel', 'graceful-spark-blog' ); ?>">
    <div class="gracefulspark-carousel-container">
        <div class="owl-carousel gracefulspark-blog-posts-carousel" role="listbox" aria-live="polite">
            <?php
            foreach ( $gracefulspark_carousel_posts as $gracefulspark_post ) :
                setup_postdata( $gracefulspark_post );
                gracefulspark_blog_carousel_render_post_card( $gracefulspark_post );
            endforeach;
            wp_reset_postdata();
            ?>
        </div>
        
        <div class="gracefulspark-sr-only" aria-live="polite" id="gracefulspark-carousel-status"></div>
    </div>
</section>