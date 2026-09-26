/*
 * COM_MAIN bootstrap for the modular Apple II background experiment.
 *
 * The original COM_MAIN.js is preserved byte-for-byte as COM_MAIN_core.js.
 * Loading both files synchronously keeps the existing application startup
 * order while adding the experimental background compositor independently.
 */
document.write('<script type="text/javascript" src="res/COM_MAIN_core.js"><\/script>');
document.write('<script type="text/javascript" src="res/COM_A2P_LAYOUT.js"><\/script>');
