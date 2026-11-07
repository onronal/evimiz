"""QR login with a loopback-only image server; no device control."""
import http.server
original=http.server.HTTPServer.__init__
def loopback(self,address,*args,**kwargs):
    return original(self,('127.0.0.1',address[1]),*args,**kwargs)
http.server.HTTPServer.__init__=loopback
from mihome_ctl.__main__ import main
if __name__=='__main__':main()
