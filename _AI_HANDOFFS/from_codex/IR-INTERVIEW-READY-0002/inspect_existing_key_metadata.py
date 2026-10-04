"""Dormant, value-free diagnostic. Import and default CLI perform no custody read.

--execute is a mechanical gate, NOT fresh independent admission. Execution needs
review of these exact bytes and fresh read approval. Never return credentials or
raw responses; the only external result is the fixed projection below.
"""
import json
import re
import sys
import time

import lease_transport as transport

_NAME = 'missionmed_lease_runtime_v5'
_PREFIX = 'sb_secret_'
_ALPHABET = re.compile(r'[A-Za-z0-9_-]*\Z', re.ASCII)
_PLACEHOLDERS = ('redacted', 'masked', 'placeholder', 'unrevealed')
_MASK_GLYPHS = frozenset('*•●█…')
_REJECTIONS = ('non_string', 'prefix', 'length', 'alphabet', 'diversity',
               'placeholder_word', 'passes_unchanged_validation')


def _unique_object(pairs):
    result = {}
    for name, value in pairs:
        if name in result:
            raise ValueError()
        result[name] = value
    return result


def _invalid_constant(value):
    raise ValueError()


def project_response(status, raw):
    """Pure bounded projection; no raw input, field list or value is returned.

    Schema classifications and all emitted keys/values are fixed. Additional
    object fields are ignored. Missing/nullable type is valid schema but cannot
    select the approved secret record. Duplicated JSON fields fail closed.
    """
    if type(status) is not int or status != 200:
        return {'http_outcome': 'non_200'}
    result = {'http_outcome': '200'}
    if type(raw) is not bytes:
        return {**result, 'response_schema': 'invalid'}
    if len(raw) > transport.MAX_BYTES:
        return {**result, 'response_schema': 'oversized'}
    try:
        rows = json.loads(raw, object_pairs_hook=_unique_object,
                          parse_constant=_invalid_constant)
        if (type(rows) is not list or any(
                type(row) is not dict or type(row.get('name')) is not str
                or ('type' in row and row['type'] is not None and
                    (type(row['type']) is not str or
                     row['type'] not in ('legacy', 'publishable', 'secret')))
                for row in rows)):
            return {**result, 'response_schema': 'invalid'}
        matching = [row for row in rows if row.get('name') == _NAME
                    and row.get('type') == 'secret']
        result.update(response_schema='array_of_objects', match_count=(
            'none' if not matching else 'one' if len(matching) == 1 else 'multiple'))
        if len(matching) != 1:
            return result
        row = matching[0]
        value = row.get('api_key')
        field = ('absent' if 'api_key' not in row else 'null' if value is None
                 else 'string' if type(value) is str else 'other')
        result['api_key_class'] = field
        flags = dict.fromkeys(_REJECTIONS, False)
        if field != 'string':
            flags['non_string'] = True
            result['validation'] = flags
            return result
        prefix = value.startswith(_PREFIX)
        result.update(exact_secret_prefix=prefix, ascii_only=value.isascii(),
                      whitespace_or_control_present=any(
                          char.isspace() or ord(char) < 32 or ord(char) == 127
                          for char in value),
                      mask_glyph_present=any(char in _MASK_GLYPHS for char in value))
        flags['prefix'] = not prefix
        if prefix:
            suffix = value[len(_PREFIX):]
            bucket = ('below_32' if len(suffix) < 32 else
                      '32_to_128' if len(suffix) <= 128 else 'above_128')
            alphabet = _ALPHABET.fullmatch(suffix) is not None
            diverse = len(set(suffix)) >= 4
            placeholder = any(word in suffix.lower() for word in _PLACEHOLDERS)
            result.update(suffix_length_bucket=bucket, suffix_alphabet_member=alphabet,
                          distinct_at_least_4=diverse, placeholder_word_present=placeholder)
            flags.update(length=bucket != '32_to_128', alphabet=not alphabet,
                         diversity=not diverse, placeholder_word=placeholder)
        else:
            # No suffix is guessed and no suffix predicate is classified.
            result['suffix_length_bucket'] = 'not_applicable'
        flags['passes_unchanged_validation'] = not any(
            flags[name] for name in _REJECTIONS[:-1])
        result['validation'] = flags
        return result
    except Exception:
        return {'http_outcome': '200', 'response_schema': 'invalid'}


def _execute():
    """Private pipeline; shared hard deadline and exactly one pinned reveal GET.

    Existing transport owns custody, 10s no-UI keychain budget, TLS, no proxy,
    redirects or retries, and 256KiB bounds. No other transport branch is called.
    """
    deadline = time.monotonic() + transport.TOTAL_SECONDS
    token = raw = None
    try:
        with transport._phase('management_token_lookup'):
            token = transport.load_existing_management_token(deadline=deadline)
        with transport._phase('management_reveal'):
            status, raw = transport._private_get('reveal', token, deadline)
            transport._remaining(deadline)
            result = project_response(status, raw)
            transport._remaining(deadline)
            return result
    finally:
        # Python cannot promise zeroization of immutable buffers; release refs.
        token = raw = None


def main(argv=None):
    arguments = sys.argv[1:] if argv is None else argv
    if arguments != ['--execute']:
        print('{"diagnostic":"dormant"}')
        return 2
    try:
        result = _execute()
        print(json.dumps(result, sort_keys=True, separators=(',', ':')))
        return (0 if result.get('match_count') == 'one' else 1)
    except transport.PhaseError as error:
        # The existing type admits fixed phase/error enums and elapsed only.
        print(error.public_status())
        return 1
    except Exception:
        # Never inspect, stringify or represent a private exception.
        print('phase=unknown; error=failed_closed')
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
