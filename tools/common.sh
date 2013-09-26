#!/bin/bash
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

# Scripts in tools/ should source this file with the line:
# pushd "$(dirname $0)" >/dev/null && source common.sh && popd >/dev/null
#
# This will set these paths:
#     TOOLS_DIR: path to this tools directory
#     APP_DIR: path to the parent of this directory, which contains app.yaml
#     APPENGINE_DIR: path to the google_appengine SDK directory
#     PYTHON: path to the Python binary to use
#
# ...and these other variables:
#     DEFAULT_PORT: number in the file $APP_DIR/DEFAULT_PORT, if present
#     USER_EMAIL: @google.com e-mail address for the current user
#
# ...and add the app modules and App Engine SDK modules to the PYTHONPATH.

export TOOLS_DIR=$(pwd)
export APP_DIR=$(dirname $TOOLS_DIR)
export LOCAL_RUN_DIR=$APP_DIR

export DEFAULT_PORT=8000

# Set DEFAULT_PORT.
if [ -f $APP_DIR/DEFAULT_PORT ]; then
  export DEFAULT_PORT=$(cat $APP_DIR/DEFAULT_PORT)
fi

# Find the App Engine SDK directory.
for dir in \
    "$APPENGINE_DIR" \
    $HOME/google_appengine \
    /usr/local/lib/google_appengine \
    /usr/local/google_appengine \
    /usr/lib/google_appengine; do
    if [ -d "$dir" ]; then
        export APPENGINE_DIR="$dir"
        break
    fi
done

if [ -z "$APPENGINE_DIR" ]; then
    echo "Could not find google_appengine directory.  Set APPENGINE_DIR."
    exit 1
fi

# Find the Python binary.
for python in \
    $(which python2.7) \
    /usr/local/bin/python2.7 \
    /usr/bin/python2.7 \
    /Library/Frameworks/Python.framework/Versions/2.7/bin/python; do
    if [ -x "$python" ]; then
        export PYTHON="$python"
        break
    fi
done

if [ -z "$PYTHON" ]; then
    echo "Could not find python2.7 executable.  Set PYTHON."
    exit 1
fi

export PYTHONPATH=\
"$TOOLS_DIR":\
"$APP_DIR":\
"$APPENGINE_DIR":\
"$APPENGINE_DIR/lib/django-1.2":\
"$APPENGINE_DIR/lib/django_1_2":\
"$APPENGINE_DIR/lib/fancy_urllib":\
"$APPENGINE_DIR/lib/webapp2-2.3":\
"$APPENGINE_DIR/lib/webapp2":\
"$APPENGINE_DIR/lib/webob-1.1.1":\
"$APPENGINE_DIR/lib/webob_1_1_1":\
"$APPENGINE_DIR/lib/yaml/lib"

# These environment variables simulate account login in tests.
if [ -z "$AUTH_DOMAIN" ]; then
    export AUTH_DOMAIN=gmail.com
fi
if [ -z "$USER_EMAIL" ]; then
    export USER_EMAIL=$(whoami)@$AUTH_DOMAIN
fi
