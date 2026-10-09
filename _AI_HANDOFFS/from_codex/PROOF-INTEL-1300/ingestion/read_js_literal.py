"""Small non-executing parser for object/array/string/number/boolean literals in WP data."""
import re
class LiteralReader:
    def __init__(self,s):self.s=s;self.i=0
    def ws(self):
        while True:
            m=re.match(r'\s+|//[^\n]*|/\*[\s\S]*?\*/',self.s[self.i:])
            if not m:return
            self.i+=m.end()
    def take(self,ch):
        self.ws();assert self.s[self.i]==ch,(self.i,ch,self.s[self.i:self.i+50]);self.i+=1
    def string(self):
        q=self.s[self.i];self.i+=1;out=''
        while self.i<len(self.s):
            c=self.s[self.i];self.i+=1
            if c==q:return out
            if c!='\\':out+=c;continue
            c=self.s[self.i];self.i+=1
            if c in 'ux':
                n=4 if c=='u' else 2;out+=chr(int(self.s[self.i:self.i+n],16));self.i+=n
            elif c in '\r\n':
                if c=='\r' and self.s[self.i:self.i+1]=='\n':self.i+=1
            else:out+={'n':'\n','r':'\r','t':'\t','b':'\b','f':'\f','v':'\v','0':'\0'}.get(c,c)
        raise ValueError('Unclosed string')
    def identifier(self):
        self.ws();m=re.match(r'[A-Za-z_$][\w$]*',self.s[self.i:]);assert m,self.i;self.i+=m.end();return m.group()
    def value(self):
        self.ws();c=self.s[self.i]
        if c in "'\"":return self.string()
        if c=='[':
            self.i+=1;a=[];self.ws()
            while self.s[self.i]!=']':
                a.append(self.value());self.ws()
                if self.s[self.i]!=',':break
                self.i+=1;self.ws()
            self.take(']');return a
        if c=='{':
            self.i+=1;a={};self.ws()
            while self.s[self.i]!='}':
                k=self.string() if self.s[self.i] in "'\"" else self.identifier();self.take(':');a[k]=self.value();self.ws()
                if self.s[self.i]!=',':break
                self.i+=1;self.ws()
            self.take('}');return a
        m=re.match(r'-?\d+(?:\.\d+)?',self.s[self.i:])
        if m:self.i+=m.end();return float(m.group()) if '.' in m.group() else int(m.group())
        word=self.identifier();assert word in ('true','false','null'),('Nonliteral token',word)
        return {'true':True,'false':False,'null':None}[word]
