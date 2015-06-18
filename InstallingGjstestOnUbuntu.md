To get a working `gjstest` command, do the following steps in order.  (This has been tested on Ubuntu 12.04 LTS.)

**libxml and libprotobuf**
  * `sudo apt-get update`
  * `sudo apt-get install libxml2-dev libprotobuf-dev`

**glog**
  * Go to http://code.google.com/p/google-glog/downloads/list and download the latest tar file.
  * Unpack the tar file, then: `./configure && make && sudo make install`

**re2**
  * Go to http://code.google.com/p/re2/downloads/list and download the latest tar file.
  * Unpack the tar file, then: `make && make test && sudo make install`

**gflags**
  * Go to http://code.google.com/p/gflags/downloads/list and download the latest tar file.
  * Unpack the tar file, then: `./configure && make && sudo make install`

**v8**
  * `git clone git://github.com/v8/v8`
  * `cd v8; make dependencies && make library=shared native`
  * `sudo cp include/* /usr/local/include/`
  * `sudo cp out/native/lib.target/libv8.so /usr/local/lib/`

**gjstest**
  * Go to http://code.google.com/p/google-js-test/downloads/list and download the latest tar file.
  * Unpack the tar file, then: `make && sudo make install`