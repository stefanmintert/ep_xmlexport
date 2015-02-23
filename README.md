# XML Export for Etherpad Lite

This plug-in lets you export the content of a pad as XML. The details of the exported XML are still subject to change.

WARNING: This is work in progress. Expect undocumented changes!


## HTTP API

### Calls

Basic call

  http://*hostPort*/p/*padName*/export/xml

Choose pad revision

  http://*hostPort*/p/*padName*/*revision*/export/xml

Control output of line attributes (handling of EPL line marker, lmkr)

  http://*hostPort*/p/*padName*/*revision*/export/xml?lineattribs=true

Control output of lists markup

  http://*hostPort*/p/*padName*/*revision*/export/xml?lists=true

### Response

Currently the MIME type `plain/xml` is used. Little is known about dealing with the correct encoding (BOM, XML declaration, HTTP header). A switch to `application/xml` might be reasonable. 


 