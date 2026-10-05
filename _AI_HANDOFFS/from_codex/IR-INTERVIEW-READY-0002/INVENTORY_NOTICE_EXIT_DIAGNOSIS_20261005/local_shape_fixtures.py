"""Synthetic private fatal-message to fixed-enum mapping; not a helper patch."""
import re,json
PATTERNS=((rb'\bCall to undefined function ','UNDEFINED_FUNCTION'),(rb'\bClass [ -~]+ not found\b','CLASS_NOT_FOUND'),(rb'\bCannot (?:redeclare|declare class) ','REDECLARE'),(rb'\bUndefined constant ','UNDEFINED_CONSTANT'),(rb'\bUncaught TypeError:','TYPE_ERROR'),(rb'\bUncaught ArgumentCountError:','ARGUMENT_COUNT_ERROR'),(rb'^Allowed memory size of [0-9]+ bytes exhausted','MEMORY'),(rb'^Maximum execution time of [0-9]+ seconds exceeded','TIME'))
def kind(raw):
 if type(raw)is not bytes or len(raw)>65536:return 'UNKNOWN'
 line=raw.split(b'\n',1)[0]
 if any(c<32 or c>126 for c in line):return 'UNKNOWN'
 found={name for pattern,name in PATTERNS if re.search(pattern,line)}
 return next(iter(found))if len(found)==1 else 'UNKNOWN'
cases=[(b'Uncaught Error: Call to undefined function PRIVATE_SYNTHETIC()','UNDEFINED_FUNCTION'),(b'Uncaught Error: Class PRIVATE_SYNTHETIC not found','CLASS_NOT_FOUND'),(b'Cannot redeclare PRIVATE_SYNTHETIC()','REDECLARE'),(b'Uncaught Error: Undefined constant PRIVATE_SYNTHETIC','UNDEFINED_CONSTANT'),(b'Uncaught TypeError: PRIVATE_SYNTHETIC','TYPE_ERROR'),(b'Uncaught ArgumentCountError: PRIVATE_SYNTHETIC','ARGUMENT_COUNT_ERROR'),(b'Allowed memory size of 12345 bytes exhausted (tried to allocate 678 bytes)','MEMORY'),(b'Maximum execution time of 42 seconds exceeded','TIME'),(b'PRIVATE_SYNTHETIC','UNKNOWN'),(b'Uncaught TypeError: PRIVATE_SYNTHETIC\x00','UNKNOWN'),(b'Uncaught TypeError: Call to undefined function PRIVATE_SYNTHETIC()','UNKNOWN'),(b'X'*65537,'UNKNOWN')]
for raw,expected in cases:
 value=kind(raw);assert value==expected
 assert 'PRIVATE_SYNTHETIC'not in json.dumps({'kind':value})
print('PASS_SYNTHETIC_CLOSED_KIND_PRIVACY_12_CASES_NO_ACTUAL_HELPER')
