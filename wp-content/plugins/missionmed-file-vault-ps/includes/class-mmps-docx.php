<?php
/**
 * Minimal, strict DOCX reader and writer. The reader walks the XML (it does
 * not strip tags): body paragraphs only, empty paragraphs kept so indices stay
 * stable, and it refuses files whose visible text is ambiguous.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class MMPS_Docx {

	const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

	/**
	 * @param string $bytes DOCX bytes.
	 * @return array|WP_Error Paragraph strings.
	 */
	public static function paragraphs_from_bytes( $bytes ) {
		if ( ! class_exists( 'ZipArchive' ) ) {
			return new WP_Error( 'mmps_docx_unsupported', 'This server cannot read DOCX files (ZipArchive missing).', array( 'status' => 501 ) );
		}
		$tmp = self::temp_file( 'mmps-root' );
		file_put_contents( $tmp, $bytes );
		$zip = new ZipArchive();
		if ( true !== $zip->open( $tmp ) ) {
			@unlink( $tmp );
			return new WP_Error( 'mmps_docx_invalid', 'That file is not a readable DOCX.', array( 'status' => 422 ) );
		}
		$xml = $zip->getFromName( 'word/document.xml' );
		$has_comments = false !== $zip->locateName( 'word/comments.xml' );
		$zip->close();
		@unlink( $tmp );
		if ( false === $xml || strlen( $xml ) > 8 * 1024 * 1024 ) {
			return new WP_Error( 'mmps_docx_invalid', 'That DOCX has no readable body.', array( 'status' => 422 ) );
		}
		return self::paragraphs_from_xml( $xml, $has_comments );
	}

	/** wp_tempnam() lives in wp-admin and is not loaded for REST or front-end requests. */
	protected static function temp_file( $prefix ) {
		if ( ! function_exists( 'wp_tempnam' ) ) {
			require_once ABSPATH . 'wp-admin/includes/file.php';
		}
		return wp_tempnam( $prefix );
	}

	public static function paragraphs_from_xml( $xml, $has_comments = false ) {
		$dom = new DOMDocument();
		if ( ! @$dom->loadXML( $xml, LIBXML_NONET | LIBXML_COMPACT ) ) {
			return new WP_Error( 'mmps_docx_invalid', 'That DOCX body could not be parsed.', array( 'status' => 422 ) );
		}
		$xp = new DOMXPath( $dom );
		$xp->registerNamespace( 'w', self::W_NS );
		if ( $xp->query( '//w:ins | //w:del | //w:moveFrom | //w:moveTo' )->length > 0 ) {
			return new WP_Error( 'mmps_docx_tracked_changes', 'This file still has tracked changes. Accept or reject all changes in Word, save, upload the clean version to File Vault, then choose it here.', array( 'status' => 422 ) );
		}
		if ( $has_comments && $xp->query( '//w:commentRangeStart | //w:commentReference' )->length > 0 ) {
			return new WP_Error( 'mmps_docx_comments', 'This file still has comments. Delete all comments in Word, save, upload the clean version to File Vault, then choose it here.', array( 'status' => 422 ) );
		}
		// Text that sits in a table, a content control or a text box is not read as body paragraphs. Refuse, never drop silently.
		if ( $xp->query( '/w:document/w:body//w:tbl//w:t[normalize-space()] | /w:document/w:body//w:sdt//w:t[normalize-space()] | /w:document/w:body//w:txbxContent//w:t[normalize-space()]' )->length > 0 ) {
			return new WP_Error( 'mmps_docx_structure', 'This file keeps some of its text inside a table, a content control or a text box. Save a copy as plain paragraphs, upload that version to File Vault, then choose it here.', array( 'status' => 422 ) );
		}
		$paragraphs = array();
		foreach ( $xp->query( '/w:document/w:body/w:p' ) as $p ) {
			$text = '';
			// Text runs only; skip field instructions, deleted text, hidden runs and AlternateContent fallbacks.
			foreach ( $xp->query( './/w:r[not(ancestor::*[local-name()="Fallback"])]', $p ) as $run ) {
				if ( $xp->query( './w:rPr/w:vanish', $run )->length > 0 ) {
					continue;
				}
				foreach ( $run->childNodes as $node ) {
					if ( XML_ELEMENT_NODE !== $node->nodeType || self::W_NS !== $node->namespaceURI ) {
						continue;
					}
					if ( 't' === $node->localName ) {
						$text .= $node->textContent;
					} elseif ( 'noBreakHyphen' === $node->localName ) {
						$text .= '-';
					} elseif ( 'tab' === $node->localName ) {
						$text .= ' ';
					} elseif ( 'br' === $node->localName || 'cr' === $node->localName ) {
						$text .= ' ';
					}
				}
			}
			$paragraphs[] = trim( preg_replace( '/[ \t\x{00A0}]+/u', ' ', $text ) );
		}
		// Keep interior empties out of the statement but never reorder: drop only empty paragraphs.
		$paragraphs = array_values( array_filter( $paragraphs, function ( $p ) {
			return '' !== $p;
		} ) );
		if ( count( $paragraphs ) < 3 ) {
			return new WP_Error( 'mmps_docx_too_short', 'That document has fewer than three paragraphs of text, so it does not look like a finished personal statement.', array( 'status' => 422 ) );
		}
		return $paragraphs;
	}

	/** Build a clean DOCX (body text only, no metadata in the body). */
	public static function bytes_from_paragraphs( $paragraphs ) {
		if ( ! class_exists( 'ZipArchive' ) ) {
			return new WP_Error( 'mmps_docx_unsupported', 'This server cannot write DOCX files (ZipArchive missing).', array( 'status' => 501 ) );
		}
		$body = '';
		foreach ( $paragraphs as $p ) {
			$body .= '<w:p><w:pPr><w:spacing w:after="200" w:line="276" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="24"/></w:rPr><w:t xml:space="preserve">' . htmlspecialchars( $p, ENT_XML1 | ENT_QUOTES, 'UTF-8' ) . '</w:t></w:r></w:p>';
		}
		$document = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="' . self::W_NS . '"><w:body>' . $body . '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>';
		$types    = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>';
		$rels     = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';
		$tmp      = self::temp_file( 'mmps-out' );
		$zip      = new ZipArchive();
		if ( true !== $zip->open( $tmp, ZipArchive::OVERWRITE ) ) {
			return new WP_Error( 'mmps_docx_write', 'Could not build the DOCX.', array( 'status' => 500 ) );
		}
		$zip->addFromString( '[Content_Types].xml', $types );
		$zip->addFromString( '_rels/.rels', $rels );
		$zip->addFromString( 'word/document.xml', $document );
		$zip->close();
		$bytes = file_get_contents( $tmp );
		@unlink( $tmp );
		return $bytes;
	}
}
