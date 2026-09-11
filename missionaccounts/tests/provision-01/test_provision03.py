import importlib.util
import pathlib
import tempfile
import unittest

PATH = pathlib.Path(__file__).resolve().parents[2] / 'scripts' / 'provision-01' / 'provision03.py'
if not PATH.exists():
    PATH = pathlib.Path(__file__).with_name('provision03.py')
SPEC = importlib.util.spec_from_file_location('provision03', PATH)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class Provision03Tests(unittest.TestCase):
    def score(self, source, roster, unique_first=False, unique_last=False):
        return MODULE.best_name_score(MODULE.name_tokens(source), MODULE.name_tokens(roster), unique_first, unique_last)

    def test_founder_examples_are_strong(self):
        examples = [
            ('Alex Ramriez', 'Alex Ramirez'),
            ('Casey Morales', 'CASEY I. MORALES CANCIO'),
            ('Morgan Lee Duchesne', 'Morgan Duchesne Mendoza'),
            ('Cassia Ugorji', 'Cassianora Ugorji'),
            ('Jordan Machuca', 'Jordan Enid Machuca Alejandro'),
        ]
        for source, roster in examples:
            with self.subTest(source=source):
                self.assertGreaterEqual(self.score(source, roster)[0], 0.92)

    def test_reversed_name(self):
        score, rule, _ = self.score('Surname Given', 'Given Surname')
        self.assertGreaterEqual(score, 0.98)
        self.assertEqual(rule, 'reversed')

    def test_unique_single_name(self):
        self.assertEqual(self.score('Onlyfirst', 'Onlyfirst Surname', unique_first=True)[1], 'unique_first')
        self.assertLess(self.score('Onlyfirst', 'Onlyfirst Surname', unique_first=False)[0], 0.93)

    def test_device_noise_is_removed(self):
        self.assertEqual(MODULE.name_tokens("UniqueName's iPhone"), ['uniquename'])

    def test_username_sequence(self):
        self.assertEqual(MODULE.username_for('John', 'Brig', {'johnb', 'johnbr'}), 'JohnBri')

    def test_private_mode(self):
        with tempfile.TemporaryDirectory() as directory:
            path = pathlib.Path(directory) / 'private.json'
            MODULE.write_private(path, {'ok': True})
            self.assertEqual(path.stat().st_mode & 0o777, 0o600)


if __name__ == '__main__':
    unittest.main()
