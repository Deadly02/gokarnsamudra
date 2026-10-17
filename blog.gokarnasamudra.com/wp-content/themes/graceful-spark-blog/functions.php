<?php
/**
 * Graceful Spark Blog functions and definitions
 *
 * @link https://developer.wordpress.org/themes/basics/theme-functions/
 *
 * @package Graceful Spark Blog
 */

// ----------------------------------------------------------------------------------
//  Register Front-End Styles And Scripts
// ----------------------------------------------------------------------------------

function graceful_spark_blog_enqueue_child_styles() {
 
    wp_enqueue_style( 'graceful-style', get_template_directory_uri() . '/style.css' );
    wp_enqueue_style( 'graceful-spark-blog-style', get_stylesheet_directory_uri() . '/style.css', array( 'graceful-style' ), wp_get_theme()->get('Version') );
}
add_action( 'wp_enqueue_scripts', 'graceful_spark_blog_enqueue_child_styles' );

// ----------------------------------------------------------------------------------
//  New Fonts
// ----------------------------------------------------------------------------------
function graceful_spark_blog_enqueue_assets()
{
    // Include the file.
    require_once get_theme_file_path('webfont-loader/wptt-webfont-loader.php');
    // Load the webfont.
    wp_enqueue_style(
        'minimalist-stories-fonts',
        wptt_get_webfont_url('https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600&display=auto'),
        array(),
        '1.0'
    );
}
add_action('wp_enqueue_scripts', 'graceful_spark_blog_enqueue_assets');


// Load after Theme Setup
function graceful_spark_blog_theme_setup() {

    // ----------------------------------------------------------------------------------
    //  Register New Sections in Customizer
    // ----------------------------------------------------------------------------------
    function graceful_spark_blog_customize_register( $wp_customize ) {

        /*** Spark Post Slider ***/
        // Spark Post Slider Banner section
        $wp_customize->add_section( 'graceful_spark_post_slider' , array(
            'title'      => esc_html__( 'Spark Post Slider', 'graceful-spark-blog' ),
            'priority'   => 27,
            'capability' => 'edit_theme_options'
        ) );


        // Spark Post Slider Enable
        $wp_customize->add_setting( 'graceful_spark_blog_options[sparkpost_slider_show]', array(
            'default'    => graceful_spark_blog_options( 'sparkpost_slider_show' ),
            'type'       => 'option',
            'transport'  => 'refresh',
            'capability' => 'edit_theme_options',
            'sanitize_callback' => 'graceful_sanitize_checkboxes'
        ) );
        $wp_customize->add_control( 'graceful_spark_blog_options[sparkpost_slider_show]', array(
            'label'     => esc_html__( 'Enable Spark Post Slider', 'graceful-spark-blog' ),
            'section'   => 'graceful_spark_post_slider',
            'type'      => 'checkbox',
            'priority'  => 1
        ) );

        // Sanitize number absint
        function graceful_sanitize_number_absint( $number, $setting ) {

            // ensure $number is an absolute integer
            $number = absint( $number );

            // return default if not integer
            return ( $number ? $number : $setting->default );

        }

        // Enqueue customizer styles
        function graceful_spark_customizer_css() {
            wp_enqueue_style( 'graceful-customize-style', get_theme_file_uri( '/assets/css/customize-ui.css' ) );
        }
        add_action( 'customize_controls_enqueue_scripts', 'graceful_spark_customizer_css' );



        /*** Top Navigation ***/
        // add Top Navigation section
        $wp_customize->add_panel(
            'layout_settings',
            array(
                'priority'   => 20,
                'capability' => 'edit_theme_options',
                'title'      => __( 'Top Navigaion', 'graceful-spark-blog' ),
            )
        );

        $wp_customize->add_section( 'graceful_top_navigation' , array(
            'title'      => esc_html__( 'Top Navigation', 'graceful-spark-blog' ),
            'priority'   => 23,
            'capability' => 'edit_theme_options'
        ) );

        // Top Navigation
        $wp_customize->add_setting( 'graceful_spark_blog_options[top_navigation_show]', array(
            'default'    => graceful_spark_blog_options('top_navigation_show'),
            'type'       => 'option',
            'transport'  => 'refresh',
            'capability' => 'edit_theme_options',
            'sanitize_callback' => 'graceful_sanitize_checkboxes'
        ) );
        $wp_customize->add_control( 'graceful_spark_blog_options[top_navigation_show]', array(
            'label'     => esc_html__( 'Enable Top Navigation', 'graceful-spark-blog' ),
            'section'   => 'graceful_top_navigation',
            'type'      => 'checkbox',
            'priority'  => 1
        ) );

        // Top Navigation Text Color
        $wp_customize->add_setting( 'graceful_spark_blog_options[top_navigation_text_color]', array(
            'default'    => graceful_spark_blog_options('top_navigation_text_color'),
            'type'       => 'option',
            'transport'  => 'refresh',
            'capability' => 'edit_theme_options',
            'sanitize_callback' => 'sanitize_hex_color'
        ) );
        $wp_customize->add_control( new WP_Customize_Color_Control( $wp_customize, 'graceful_spark_blog_options[top_navigation_text_color]', array(
            'label'     => esc_html__( 'Top Navigation Text Color', 'graceful-spark-blog' ),
            'section'   => 'graceful_top_navigation',
            'priority'  => 5
        ) ) );

        $wp_customize->add_setting( 'graceful_spark_blog_options[main_navigation_bg]', array(
            'default'    => graceful_spark_blog_options('main_navigation_bg'),
            'type'       => 'option',
            'transport'  => 'refresh',
            'capability' => 'edit_theme_options',
            'sanitize_callback' => 'sanitize_hex_color'
        ) );
        $wp_customize->add_control( new WP_Customize_Color_Control( $wp_customize, 'graceful_spark_blog_options[main_navigation_bg]', array(
            'label'     => esc_html__( 'Main Navigation Background Color', 'graceful-spark-blog' ),
            'section'   => 'graceful_main_navigation',
            'priority'  => 15
        ) ) );

        $wp_customize->add_setting( 'graceful_spark_blog_options[main_navigation_active_link_color]', array(
            'default'    => graceful_spark_blog_options('main_navigation_active_link_color'),
            'type'       => 'option',
            'transport'  => 'refresh',
            'capability' => 'edit_theme_options',
            'sanitize_callback' => 'sanitize_hex_color'
        ) );
        $wp_customize->add_control( new WP_Customize_Color_Control( $wp_customize, 'graceful_spark_blog_options[main_navigation_active_link_color]', array(
            'label'     => esc_html__( 'Main Navigation Active Link Color', 'graceful-spark-blog' ),
            'section'   => 'graceful_main_navigation',
            'priority'  => 15
        ) ) );



        /*** Favorite Categories ***/
        // Favorite Categories section
        $wp_customize->add_section( 'graceful_favorite_categories' , array(
            'title'      => esc_html__( 'Favorite Categories', 'graceful-spark-blog' ),
            'priority'   => 27,
            'capability' => 'edit_theme_options',
            'description' => esc_html__( 'Select categories to display on homepage.', 'graceful-spark-blog' ),
        ) );

        // Favorite Categories Enable
        $wp_customize->add_setting( 'graceful_spark_blog_options[favorite_categories_show]', array(
            'default'    => graceful_spark_blog_options( 'favorite_categories_show' ),
            'type'       => 'option',
            'transport'  => 'refresh',
            'capability' => 'edit_theme_options',
            'sanitize_callback' => 'graceful_sanitize_checkboxes'
        ) );
        $wp_customize->add_control( 'graceful_spark_blog_options[favorite_categories_show]', array(
            'label'     => esc_html__( 'Enable Favorite Categories Section', 'graceful-spark-blog' ),
            'section'   => 'graceful_favorite_categories',
            'type'      => 'checkbox',
            'priority'  => 1
        ) );

        // Section Title
        $wp_customize->add_setting( 'graceful_spark_blog_options[favorite_categories_title]', array(
            'default'    => graceful_spark_blog_options( 'favorite_categories_title' ),
            'type'       => 'option',
            'transport'  => 'refresh',
            'capability' => 'edit_theme_options',
            'sanitize_callback' => 'sanitize_text_field'
        ) );
        $wp_customize->add_control( 'graceful_spark_blog_options[favorite_categories_title]', array(
            'label'     => esc_html__( 'Section Title', 'graceful-spark-blog' ),
            'section'   => 'graceful_favorite_categories',
            'type'      => 'text',
            'priority'  => 3
        ) );

        // Get all categories for dropdown options
        $categories = get_categories( array( 'hide_empty' => false ) );
        $cat_choices = array( '0' => esc_html__( '-- Select Category --', 'graceful-spark-blog' ) );

        foreach ( $categories as $category ) {
            $cat_choices[ $category->term_id ] = esc_html( $category->name );
        }

        // Set up category slots (4 slots)
        $max_slots = 4;

        for ( $i = 1; $i <= $max_slots; $i++ ) {
            // Category Selection
            $wp_customize->add_setting( 'graceful_spark_blog_options[favorite_category_' . $i . ']', array(
                'default'    => graceful_spark_blog_options( 'favorite_category_' . $i ),
                'type'       => 'option',
                'transport'  => 'refresh',
                'capability' => 'edit_theme_options',
                'sanitize_callback' => 'absint'
            ) );
            
            $wp_customize->add_control( 'graceful_spark_blog_options[favorite_category_' . $i . ']', array(
                // translators: %d refers to the category number in the Favorite Categories section.
                'label'    => sprintf( esc_html__( 'Category #%d', 'graceful-spark-blog' ), $i ),
                'section'  => 'graceful_favorite_categories',
                'type'     => 'select',
                'choices'  => $cat_choices,
                'priority' => 10 + ($i * 2)
            ) );
            
            // Category Image
            $wp_customize->add_setting( 'graceful_spark_blog_options[favorite_category_image_' . $i . ']', array(
                'default'   => '',
                'type'      => 'option',
                'transport' => 'refresh',
                'sanitize_callback' => 'graceful_sanitize_number_absint'
            ) );
            
            $wp_customize->add_control(
                new WP_Customize_Cropped_Image_Control( $wp_customize, 'graceful_spark_blog_options[favorite_category_image_' . $i . ']', array(
                    // translators: %d refers to the category number in the Favorite Categories section.
                    'label'         => sprintf( esc_html__( 'Category #%d Image', 'graceful-spark-blog' ), $i ),
                    'section'       => 'graceful_favorite_categories',
                    'flex_width'    => false,
                    'flex_height'   => false,
                    'width'         => 600,
                    'height'        => 600,
                    'priority'      => 11 + ($i * 2)
                )
            ) );
        }

        // Favorite Categories Layout Width
        $boxed_width_favorite_categories = array(
            'full' => esc_html__( 'Full', 'graceful-spark-blog' ),
            'wrapped' => esc_html__( 'Boxed', 'graceful-spark-blog' ),
        );

        $wp_customize->add_setting( 'graceful_spark_blog_options[favorite_categories_width]', array(
            'default'    => graceful_spark_blog_options( 'favorite_categories_width' ),
            'type'       => 'option',
            'transport'  => 'refresh',
            'capability' => 'edit_theme_options',
            'sanitize_callback' => 'graceful_sanitize_select'
        ) );
        $wp_customize->add_control( 'graceful_spark_blog_options[favorite_categories_width]', array(
            'label'         => esc_html__( 'Favorite Categories Width', 'graceful-spark-blog' ),
            'section'       => 'graceful_basic',
            'type'          => 'select',
            'choices'       => $boxed_width_favorite_categories,
            'priority'      => 29
        ) );


    }
    add_action( 'customize_register', 'graceful_spark_blog_customize_register', 99 );


    register_nav_menus(
        array(
            'top'  => esc_html__( 'Top Menu', 'graceful-spark-blog' ),
        )
    );

    function graceful_top_menu_fallback() {
        if ( current_user_can( 'edit_theme_options' ) ) {
            ?>
            <ul id="top-menu">
                <li>
                    <a href="<?php echo esc_url( home_url( '/wp-admin/nav-menus.php') ) ?>">
                        <?php esc_html_e( 'Set-up Top Menu', 'graceful-spark-blog' ) ?>
                    </a>
                </li>
            </ul>
            <?php
        }
    }

   function graceful_spark_blog_options( $controls ) {

        $graceful_spark_blog_defaults = array(
            'sparkpost_slider_show' => true,
            'top_navigation_show' => false,
            'top_navigation_text_color' => '#ffffff',
            'main_navigation_bg' => '#ffffff',
            'main_navigation_active_link_color' => '#5686fe',
            'blog_grid_excerpt_length' => '50',
            'favorite_categories_show' => false,
            'favorite_categories_width' => 'wrapped',
            'favorite_categories_title' => esc_html__( 'Favorite Categories', 'graceful-spark-blog' ),
            'favorite_category_1' => 0,
            'favorite_category_2' => 0,
            'favorite_category_3' => 0,
            'favorite_category_4' => 0,
            'favorite_category_image_1' => '',
            'favorite_category_image_2' => '',
            'favorite_category_image_3' => '',
            'favorite_category_image_4' => ''
        );

        // merge defaults and options
        $graceful_spark_blog_defaults = wp_parse_args( get_option( 'graceful_spark_blog_options' ), $graceful_spark_blog_defaults );

        // return control
        return $graceful_spark_blog_defaults[ $controls ];
    }

}
add_action( 'after_setup_theme', 'graceful_spark_blog_theme_setup' );

