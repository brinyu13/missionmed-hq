import importlib.util,pathlib,tempfile,unittest
P=pathlib.Path(__file__).resolve().parents[2]/'scripts'/'provision-01'/'provision02.py';spec=importlib.util.spec_from_file_location('p02',P);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Tests(unittest.TestCase):
 def test_name_normalization(self):
  self.assertEqual(m.normalize_name(" José O'Neil "),'joseoneil');self.assertEqual(m.first_last_key('Jane Q Public'),'janepublic');self.assertEqual(m.token_set_key('Public Jane'),'jane|public')
 def test_username_sequence(self):
  self.assertEqual(m.username_for('John','Brig',{'johnb','johnbr'}),'JohnBri')
 def test_unique_email_row(self):
  idx={'email':{'a@example.test':{7}}};self.assertEqual(m.unique_email_row({'email':'A@example.test'},idx),7);self.assertIsNone(m.unique_email_row({'email':'x@example.test'},idx))
 def test_private_mode(self):
  with tempfile.TemporaryDirectory() as d:
   p=pathlib.Path(d)/'x';m.write_private(p,'x');self.assertEqual(p.stat().st_mode & 0o777,0o600)
if __name__=='__main__':unittest.main()
