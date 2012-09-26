# Copyright 2012 Google Inc.  All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License"); you may not
# use this file except in compliance with the License.  You may obtain a copy
# of the License at: http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software distrib-
# uted under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES
# OR CONDITIONS OF ANY KIND, either express or implied.  See the License for
# specific language governing permissions and limitations under the License.

# NOTE(kpy): This doesn't split the JS into modules; it just emits everything
# into the main JS file.  Fine for development but not for a production release.

# CLOSURE_DIR should contain closure/bin, closure/goog, and compiler.jar.
CLOSURE_DIR=$(HOME)/closure

# Output directories.
OUT_DIR=js/compiled

# Produce a checksum from the provide and require lines in all the files.
MD5 := $(shell if which md5 >/dev/null; then echo md5; else echo md5sum; fi)
DEP_SUM := $(shell egrep 'goog.(provide|require)' js/* | $(MD5) | cut -f1 -d' ')

# The external/ directory contains external dependencies (all fetched by make).
EXTERNALS=external/google_maps_api_v3.js external/html4-defs.js external/html-sanitizer.js external/maps_api.js

# Output files.
OUT=$(OUT_DIR)/crisismap_main__en.js
OUT_OPT=$(OUT).opt
OUT_DBG=$(OUT).dbg
LIST=$(OUT_DIR)/list.$(DEP_SUM)

# The source files are found in Closure, in external/, and in js/.
SOURCE_DIR_OPTIONS=-p $(CLOSURE_DIR)/closure \
                   -p $(CLOSURE_DIR)/third_party/closure \
                   -p external \
                   -p js

# The final targets are initialize and any other _module files.
TARGET_OPTIONS := -i js/initialize.js \
                  $(shell for i in js/*_module.js; do echo '-i' $$i; done)

# Build without optimizations, then copy over the result.
dbg: languages.py static/mapviewer.css $(OUT_DBG)
	@cd static && ln -sf ../resource/*.png .
	@cp $(OUT_DBG) $(OUT)
	@ls -l $(OUT)

# Build with optimizations (e.g. variable renaming), then copy over the result.
opt: languages.py static/mapviewer.css $(OUT_OPT)
	@cd static && ln -sf ../resource/*.png .
	@cp $(OUT_OPT) $(OUT)
	@ls -l $(OUT)

# Generate the list of all necessary files in dependency-sorted order.
list: $(LIST)

# Run a test using gjstest.
%_test: $(LIST) static/json_files.js
	@gjstest --js_files=js/test_bootstrap.js,external/maps_api.js,$$(tr '\n' ',' < $(LIST)),static/json_files.js,js/test_utils.js,js/$@.js | python tools/format_gjstest_output.py

# Build the HTML file for a test using gjstest.
%_test.html: $(LIST) static/json_files.js
	gjstest --js_files=js/test_bootstrap.js,external/maps_api.js,$$(tr '\n' ',' < $(LIST)),static/json_files.js,js/test_utils.js,js/$$(echo $@ | sed -e 's/\.html/.js/') --html_output_file=$@
	@ls -l $@

# Delete all the output.
clean:
	find static -type l -exec rm '{}' ';'
	rm -rf static/mapviewer.css static/json_files.js
	rm -rf $(OUT_DIR)

# Concatenate all the CSS files.
CSS_INPUTS := $(shell echo resource/*.css)
static/mapviewer.css: $(CSS_INPUTS)
	cat $(CSS_INPUTS) > $@

# Concatenate all the JSON files.
JSON_INPUTS := $(shell echo resource/*.json)
static/json_files.js: $(JSON_INPUTS)
	@echo "goog.provide('cm.json_files');" > $@
	@echo "cm.json_files = {};" >> $@
	@for file in $(JSON_INPUTS); do name=$$(basename $${file%.json}); echo "cm.json_files.$$name =" >> $@; cat $$file >> $@; echo ";" >> $@; done
	@ls -al $@

# Copy the language_defs file to languages.py.
languages.py: js/language_defs
	cp $< $@

# Download a local copy of the Maps API JavaScript.
MAPS_API_MODULES=places,search,visualization,weather
external/maps_api.js:
	curl $$(curl 'http://maps.google.com/maps/api/js?libraries=$(MAPS_API_MODULES)&sensor=false' | grep 'getScript("' | sed -e 's/.*"\([^"]*\)".*/\1/') > $@

# Download the externs file for the Maps API.
external/google_maps_api_v3.js:
	@mkdir -p external
	curl -o $@ http://closure-compiler.googlecode.com/svn/trunk/contrib/externs/maps/google_maps_api_v3.js

# Download html-sanitizer.js from the google-caja project.
external/html-sanitizer.js:
	@mkdir -p external
	curl -o $@ http://google-caja.googlecode.com/svn/trunk/src/com/google/caja/plugin/html-sanitizer.js

# Build html4-defs.js from google-caja.  Requires svn and ant.
external/html4-defs.js:
	@mkdir -p external
	cd /tmp; svn co http://google-caja.googlecode.com/svn/trunk/ google-caja
	cd /tmp/google-caja; ant
	cp /tmp/google-caja/ant-lib/com/google/caja/plugin/html4-defs.js $@

# Generate the list of all necessary files in dependency-sorted order.
$(LIST): $(EXTERNALS)
	@mkdir -p $(OUT_DIR)
	@# Because OUT_DIR is under js/, the compiler will try to compile
	@# *.js files in OUT_DIR unless we remove them first.
	@rm -f $(OUT_DIR)/*.js
	@echo external/html4-defs.js > $@
	@echo external/html-sanitizer.js >> $@
	$(CLOSURE_DIR)/closure/bin/calcdeps.py \
	    $(SOURCE_DIR_OPTIONS) \
	    $(TARGET_OPTIONS) \
	    -o list \
	    >> $@
	@tools/generate_build_info > $(OUT_DIR)/build_info.js
	@echo $(OUT_DIR)/build_info.js >> $@

# Compile with optimizations.
$(OUT_OPT): $(EXTERNALS) js/*.js
	@mkdir -p $(OUT_DIR)
	@# Because OUT_DIR is under js/, the compiler will try to compile
	@# *.js files in OUT_DIR unless we remove them first.
	@rm -f $(OUT_DIR)/*.js
	@tools/generate_build_info > $(OUT_DIR)/build_info.js
	$(CLOSURE_DIR)/closure/bin/calcdeps.py \
	    $(SOURCE_DIR_OPTIONS) \
	    -i external/html4-defs.js \
	    -i external/html-sanitizer.js \
	    $(TARGET_OPTIONS) \
	    -i $(OUT_DIR)/build_info.js \
	    -o compiled \
	    -c $(CLOSURE_DIR)/compiler.jar \
	    -f --compilation_level=ADVANCED_OPTIMIZATIONS \
	    -f --externs=js/externs.js \
	    -f --externs=external/google_maps_api_v3.js \
	    > $@

# Just concatenate, don't compile (for quick building and easy debugging).
$(OUT_DBG): $(LIST) $(EXTERNALS) js/*.js
	@mkdir -p $(OUT_DIR)
	@tools/generate_build_info > $(OUT_DIR)/build_info.js
	cat $$(cat $(LIST)) > $@
