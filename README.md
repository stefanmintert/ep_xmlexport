# XML Export for Etherpad Lite

This plug-in lets you export the content of a pad as XML. The details of the exported XML are still subject to change.

WARNING: This is work in progress. Expect undocumented changes!


## Usage

You can use the plug-in via a graphical UI or via HTTP API calls. 

## UI

The plug-in adds itself to the list of export formats. Choose `XML` from list of formats. 

You can't control the XML output format using the GUI. If you need something different from the default XML, use the HTTP API instead.

TODO: Make the default configurable. 


## HTTP API

### Request URIs

####Basic call, requesting generic EPL XML

    http://<hostPort>/p/<padName>/export/xml

####Choose pad revision, requesting generic EPL XML

    http://<hostPort>/p/<padName>/<revision>/export/xml

####Control output of line attributes (handling of EPL line marker, lmkr), requesting extented EPL XML

    http://<hostPort>/p/<padName>/<revision>/export/xml?lineattribs=true

Removes the line marker (asterisk with attribute lmkr) from a line and adds all lmkr attributes as XML attributes to the `line` element. `key`/`value` become the name/value of the correpsonding line attribute.  

####Control output of lists markup, requesting extented EPL XML

    http://<hostPort>/p/<padName>/<revision>/export/xml?lists=true

Generates `list` and `item` elements. 

### Response

#### MIME type and encoding

Currently the MIME type `plain/xml` is used. A switch to `application/xml` might be reasonable. 

Little is known about dealing with the correct encoding (BOM, XML declaration, HTTP header) in EPL. If you think I'm doing wrong, let me know (fork & PR appreciated).

#### Message body

The plug-in produces well-formed XML.

You have the choice of exporting *generic EPL XML* or *extended EPL XML* (non-generic). What does this mean?

##### Generic EPL XML (default)

The generic export mode simply translates every line of pad content into a `line` element in XML, and every pad attribute into an `attribute` element in XML. `attribute` *elements* carry `key` and `value` XML *attributes*. (Don't get confused: EPL attributes are transformed to XML elements named "attribute"; their key/values are transformed to XML attributes.) 

You can validate the generic EPL XML against the [epl.dtd](epl.dtd).

##### Extended EPL XML

The XML format changes if at least one of the output control parameters are set to `true`. How the format changes is described for each of the control paramaters, see above.

There's no only an experimental DTD for extended EPL XML: [epl-x.dtd](epl-x.dtd). Why experimental? Because the XML format changes with every new plug-in that introduces a new line marker attribute. BTW: The '-x' means "extended", not "experimental".



## Legal Information

The work on this plug-in began as a fork of <https://github.com/edy/ep_latexexport>, which is available under an Apache license. 

It's now a project on it's own with significant changes. Furthermore I plan a major re-factoring of the current code.

My own part of work is available under the following license.

       Copyright 2015 Stefan Mintert
    
       Licensed under the Apache License, Version 2.0 (the "License");
       you may not use this file except in compliance with the License.
       You may obtain a copy of the License at
    
         http://www.apache.org/licenses/LICENSE-2.0
    
       Unless required by applicable law or agreed to in writing, software
       distributed under the License is distributed on an "AS IS" BASIS,
       WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
       See the License for the specific language governing permissions and
       limitations under the License.

