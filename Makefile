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

# Output files.
# TODO(kpy): Currently, js/ contains JavaScript source files and js/compiled/
# contains the compiler output.  Putting output under js/ convolutes the build
# because the outputs get picked up as inputs; move it out of js/ someday.
OUT_DIR=js/compiled
OUT=$(OUT_DIR)/crisismap_main__en.js
OUT_OPT=$(OUT).opt
OUT_DBG=$(OUT).dbg

# The $(LIST) file will list all the JS files in dependency-sorted order.
# This order is determined entirely by the goog.provide/require declarations,
# so we name the $(LIST) target using a checksum of just those lines.
MD5 := $(shell if which md5 >/dev/null; then echo md5; else echo md5sum; fi)
DEP_SUM := $(shell egrep -d skip 'goog.(provide|require)' js/* | sort | $(MD5) | cut -f1 -d' ')
LIST=$(OUT_DIR)/list.$(DEP_SUM)

# aux/ contains auxiliary JS input files, all generated or fetched by make.
AUX=aux/build_info.js \
    aux/css.js \
    aux/google_maps_api_v3_11.js \
    aux/html-css-sanitizer.js \
    aux/json_files.js \
    aux/maps_api.js \
    aux/uri.js

# Files that are used only by JS tests.
TEST_FAKES=js/test_bootstrap.js,aux/maps_api.js
TEST_DEPS=aux/json_files.js,js/test_utils.js,$(CLOSURE_DIR)/closure/goog/testing/events/events.js

# The source files are found in Closure, in aux/, and in js/.
SOURCE_DIR_OPTIONS=-p $(CLOSURE_DIR)/closure \
                   -p $(CLOSURE_DIR)/third_party/closure \
                   -p aux \
                   -p js

# The final targets are initialize.js and any other *_module.js files.
TARGET_OPTIONS := -i js/initialize.js \
                  -i js/navigation_and_logo_plugin.js \
                  -i js/navigation_view.js \
                  -i js/logo_view.js \
                  $(shell for i in js/*_module.js; do echo '-i' $$i; done)


# MAIN TARGETS ----------------------------------------------------------------

# Build without optimizations, then copy over the result.
dbg: languages.py static/mapviewer.css $(OUT_DBG)
	@cp $(OUT_DBG) $(OUT)
	@ls -l $(OUT)
	@cd static && ln -sf ../resource/*.png .

# Build with optimizations (e.g. variable renaming), then copy over the result.
opt: languages.py static/mapviewer.css $(OUT_OPT)
	@cp $(OUT_OPT) $(OUT)
	@ls -l $(OUT)
	@cd static && ln -sf ../resource/*.png .

# Build the app without optimizations and start the development appserver.
run: dbg
	tools/run

# Build the app with optimizations and start the development appserver.
optrun: opt
	tools/run

# Delete all the output except html-css-sanitizer.js (which takes forever to
# generate).
clean:
	rm -rf $$(ls -1 aux/* 2>/dev/null | grep -v aux/html-css-sanitizer.js)
	rm -rf languages.py *.pyc static/mapviewer.css $(OUT_DIR)
	find static -type l -exec rm '{}' ';'  # remove all symbolic links
	@echo
	@echo "Everything cleaned except aux/html-css-sanitizer.js; if you're "
	@echo "sure you want to regenerate it (may take 2 to 6 minutes), you "
	@echo "can run 'rm aux/*'"

# Run all the JS and Python tests (we need languages.py for Python tests).
test: languages.py aux/json_files.js $(LIST)
	@gjstest --js_files=$(TEST_FAKES),$$(tr '\n' ',' < $(LIST)),$(TEST_DEPS),$$(echo js/*_test.js | tr ' ' ',') | \
	    python tools/format_gjstest_output.py && \
	    echo "All JS tests passed." && \
	    echo && \
	    tools/pytests && \
	    echo && \
	    echo "All JS and Python tests passed."

# Run a single JS test using gjstest.
%_test: aux/json_files.js $(LIST)
	@gjstest --js_files=$(TEST_FAKES),$$(tr '\n' ',' < $(LIST)),$(TEST_DEPS),js/$@.js | \
	    python tools/format_gjstest_output.py

# Build the HTML file for a test using gjstest.
%_test.html: aux/json_files.js $(LIST)
	gjstest --js_files=$(TEST_FAKES),$$(tr '\n' ',' < $(LIST)),$(TEST_DEPS),js/$$(echo $@ | sed -e 's/\.html/.js/') --html_output_file=$@
	@ls -l $@


# GENERATED FILES NEEDED BY APPSERVER -----------------------------------------

# Copy the language_defs file to languages.py.
languages.py: js/language_defs
	cp $< $@

# Concatenate all the CSS files.
static/mapviewer.css: resource/*.css
	cat $^ > $@


# AUXILIARY JS INPUTS ---------------------------------------------------------

# Generate a file of build information.  Regenerated every time.
.FORCE:
aux/build_info.js: .FORCE
	@mkdir -p aux
	@tools/generate_build_info > $@.new
	@if diff $@ $@.new 2>/dev/null; then rm $@.new; else mv $@.new $@; fi

# Generate the CSS constants from all the JS files.
aux/css.js: js/*.js
	@mkdir -p aux
	@python js/generate_css_constants.py $^ > $@

# Download the externs file for the Maps API.
aux/google_maps_api_v3_11.js:
	@mkdir -p aux
	curl -o $@ http://closure-compiler.googlecode.com/svn/trunk/contrib/externs/maps/google_maps_api_v3_11.js

# Build html-css-sanitizer.js from google-caja; requires ant.
aux/html-css-sanitizer.js:
	@mkdir -p aux
	cd /tmp; if ! test -d google-caja; then svn co http://google-caja.googlecode.com/svn/trunk/ google-caja; fi;
	cd /tmp/google-caja; ant jars-no-src
	cp /tmp/google-caja/ant-lib/com/google/caja/plugin/html-css-sanitizer-minified.js $@

# Concatenate all the JSON files.
aux/json_files.js: resource/*.json
	@mkdir -p aux
	@echo "goog.provide('cm.json_files');" > $@
	@echo "cm.json_files = {};" >> $@
	@for file in $^; do \
	    name=$$(basename $${file%.json}); \
	    echo "cm.json_files.$$name =" >> $@; \
	    cat $$file >> $@; \
	    echo ";" >> $@; \
	done
	@ls -al $@

# Download a local copy of the Maps API JavaScript.
MAPS_API_MODULES=places,search,visualization,weather
aux/maps_api.js:
	@mkdir -p aux
	curl $$(curl 'http://maps.google.com/maps/api/js?libraries=$(MAPS_API_MODULES)&sensor=false' | \
	    grep 'getScript("' | \
	    sed -e 's/.*"\([^"]*\)".*/\1/') > $@

# Download uri.js from the google-caja project.
aux/uri.js:
	@mkdir -p aux
	curl -o $@ http://google-caja.googlecode.com/svn/trunk/src/com/google/caja/plugin/uri.js


# JS COMPILATION --------------------------------------------------------------

# Generate the list of all necessary files in dependency-sorted order.
$(LIST):
	@# We don't declare $(AUX) as a dependency because we don't want to
	@# re-run calcdeps.py (slow!) every time css.js changes, but we do need
	@# the $(AUX) files to exist, so we generate them with make (fast!).
	@$(MAKE) $(AUX)
	@mkdir -p $(OUT_DIR)
	@> $@  # creates the file or truncates it to zero length
	@echo aux/uri.js >> $@
	@echo aux/html-css-sanitizer.js >> $@
	@# Because OUT_DIR is under js/, the compiler will try to compile
	@# *.js files in OUT_DIR unless we remove them first.
	@rm -f $(OUT_DIR)/*.js
	python $(CLOSURE_DIR)/closure/bin/calcdeps.py \
	    $(SOURCE_DIR_OPTIONS) \
	    $(TARGET_OPTIONS) \
	    -o list \
	    >> $@ || (rm $@ && exit 1)
	@echo aux/build_info.js >> $@

# Compile with optimizations.
$(OUT_OPT): $(AUX) js/*.js
	@mkdir -p $(OUT_DIR)
	@# Because OUT_DIR is under js/, the compiler will try to compile
	@# *.js files in OUT_DIR unless we remove them first.
	@rm -f $(OUT_DIR)/*.js
	python $(CLOSURE_DIR)/closure/bin/calcdeps.py \
	    $(SOURCE_DIR_OPTIONS) \
	    -i aux/uri.js \
	    -i aux/html-css-sanitizer.js \
	    $(TARGET_OPTIONS) \
	    -i aux/build_info.js \
	    -o compiled \
	    -c $(CLOSURE_DIR)/compiler.jar \
	    -f --compilation_level=ADVANCED_OPTIMIZATIONS \
	    -f --externs=js/externs.js \
	    -f --externs=aux/google_maps_api_v3_11.js \
	    > $@

# Just concatenate, don't compile (for quick building and easy debugging).
$(OUT_DBG): $(LIST) $(AUX) js/*.js
	@mkdir -p $(OUT_DIR)
	cat $$(cat $(LIST)) > $@
