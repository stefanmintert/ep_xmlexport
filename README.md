# XML Export for Etherpad Lite

This plug-in lets you export the content of a pad as XML. The details of the exported XML are still subject to change.

WARNING: This is work in progress. Expect undocumented changes!


## Usage

You can use the plug-in via a graphical UI or via HTTP API calls. 

## UI

The plug-in adds itself to the list of export formats. Choose `XML` from list of formats. 

You can't control the output format using the GUI. If you need something different than the default XML, use the HTTP API instead.

TODO: Make the default configurable. 


## HTTP API

### Calls

####Basic call

    http://<hostPort>/p/<padName>/export/xml

####Choose pad revision

    http://<hostPort>/p/<padName>/<revision>/export/xml

####Control output of line attributes (handling of EPL line marker, lmkr)

    http://<hostPort>/p/<padName>/<revision>/export/xml?lineattribs=true

####Control output of lists markup

    http://<hostPort>/p/<padName>/<revision>/export/xml?lists=true

### Response

#### MIME type and encoding

Currently the MIME type `plain/xml` is used. Little is known about dealing with the correct encoding (BOM, XML declaration, HTTP header). A switch to `application/xml` might be reasonable. 

#### Message body

TODO: Provide a DTD/Schema for XML format

Note: The XML formats changes if output control parameters are set to `true`. A detailed description will follow.
