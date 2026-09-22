<?php
/** Static boundary proof for the application-eve Mad-Lib fallback gate. */
declare(strict_types=1);
$root = dirname( __DIR__, 2 ) . '/wp-content/plugins/missionmed-file-vault-ps/';
$generator = (string) file_get_contents( $root . 'includes/class-mmps-generator.php' );
$rest = (string) file_get_contents( $root . 'includes/class-mmps-rest.php' );
$edit = (string) file_get_contents( $root . 'includes/class-mmps-edit.php' );
$ui = (string) file_get_contents( $root . 'assets/mmps-app.js' );
$pass = 0; $fail = 0;
function madlib_gate_check( bool $ok, string $label ): void { global $pass, $fail; if ( $ok ) { $pass++; echo "PASS: $label\n"; } else { $fail++; fwrite( STDERR, "FAIL: $label\n" ); } }

madlib_gate_check( str_contains( $generator, 'const SLOTTED_TEMPLATES_AVAILABLE = false' ), 'slotted templates are disabled by a code-owned server constant' );
madlib_gate_check( substr_count( $generator, 'self::template_gate( $root )' ) >= 2, 'new generation and stored preview both enforce the server gate' );
madlib_gate_check( str_contains( $rest, 'MMPS_Generator::template_gate( $root )' ) && str_contains( $rest, "'APPROVED' === \$status" ), 'template confirmation, save and approval boundaries enforce the gate' );
madlib_gate_check( str_contains( $edit, 'MMPS_Generator::template_gate( $root )' ), 'stored edit and revalidation boundaries enforce the gate' );
madlib_gate_check( str_contains( $ui, "template.kind === 'SLOTTED' && S.boot.contract.slottedTemplatesAvailable === false" ), 'student UI hides slotted-template controls from the server capability' );
madlib_gate_check( str_contains( $generator, 'Use [Program Paragraph Here]' ) && str_contains( $generator, '*Your Program* remains supported' ), 'fallback message preserves blank-template and exact program-token paths' );

echo 'PSV APPLICATION-EVE MAD-LIB GATE CONTRACT: ' . ( $fail ? 'FAIL' : 'PASS' ) . " ($pass passed, $fail failed)\n";
exit( $fail ? 1 : 0 );
