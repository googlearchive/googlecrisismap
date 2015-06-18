You can develop on Linux or Mac, though these instructions are easier for Mac.

<br>
<h3>Step 1. Get tools</h3>

Do these steps in order.<br>
<br>
<b>Python 2.7</b>
<ul><li>Linux: Try running <code>python2.7</code> to see if you already have it.  If not, go to the <a href='http://www.python.org/download/releases/2.7.3'>Python site</a>, download, and install.<br>
</li><li>Mac: Nothing to do; it's already installed.</li></ul>

<b>Java 7</b>
<ul><li>All platforms: Try <code>java -version</code> to see what you have. If you don't see "version 1.7" then <a href='http://www.oracle.com/technetwork/java/javase/downloads/index.html'>download from Oracle</a> and install.</li></ul>

<b>Mercurial</b>
<ul><li>Ubuntu Linux: <code>sudo apt-get install mercurial</code>
</li><li>Mac or other Linux: Go to the <a href='http://mercurial.selenic.com/'>Mercurial site</a>, download, and install.  Close any existing terminal windows.</li></ul>

<b>make</b>
<ul><li>Linux: Nothing to do; it's already installed.<br>
</li><li>Mac: Go to <a href='http://developer.apple.com/downloads'>http://developer.apple.com/downloads</a>, download Command Line Tools for XCode, and install. You will need to obtain a (free) Apple developer ID in order to download.</li></ul>

<b>Closure Compiler and Library</b>
<ul><li>All platforms:<br>
<ul><li>Make a local clone of the Closure library in your $HOME directory by typing:<br>
<pre><code>git clone https://github.com/google/closure-library.git closure<br>
</code></pre>
<ul><li>The directory $HOME/closure should now exist.<br>
</li></ul></li><li>Download <a href='http://dl.google.com/closure-compiler/compiler-latest.zip'>the compiler zip file</a> and unzip it in $HOME/closure (ignore the warning about overwriting README).<br>
<ul><li>$HOME/closure/closure/goog and $HOME/closure/compiler.jar should now exist.</li></ul></li></ul></li></ul>

<b>App Engine SDK 1.8 for Python</b> (note, some versions below 1.7.6 have bugs!)<br>
<ul><li>All platforms:<br>
<ul><li>Download <a href='http://googleappengine.googlecode.com/files/google_appengine_1.8.9.zip'>the SDK zip file</a>.<br>
</li><li>In your $HOME directory, unzip the zip file.<br>
</li><li>$HOME/google_appengine/dev_appserver.py should now exist.</li></ul></li></ul>

<b>py.test</b> (optional, but recommended)<br>
<ul><li>All platforms: In a terminal window, type: <code>sudo easy_install-2.7 pytest</code></li></ul>

<b>Google JS Test</b>

<ul><li>Linux: See <a href='InstallingGjstestOnUbuntu.md'>instructions for Ubuntu</a> or <a href='https://code.google.com/p/google-js-test/wiki/Installing'>general instructions</a>.<br>
</li><li>Mac: Go to the <a href='https://drive.google.com/#folders/0Bx3lspqM75QyUm45VjAzal83N0E'>downloads folder</a> and download gjstest-kegs.tar.gz.  Unpack it in /usr/local with the following commands:<br>
<pre><code>cd /usr/local<br>
sudo tar xvfz ~/Downloads/gjstest-kegs.tar.gz<br>
</code></pre>
<ul><li>This will put libraries in /usr/local/Cellar and add symlinks to /usr/local/lib and /usr/local/bin.  You may need to add /usr/local/bin to your $PATH.</li></ul></li></ul>

<h3>Step 2. Get the code</h3>

<ul><li>Create a text file at $HOME/.hgrc containing these two lines (fill in your name and e-mail address):<br>
<pre><code>[ui]<br>
username = John Doe &lt;john@example.com&gt;<br>
</code></pre></li></ul>

<ul><li>Make a local clone of the code repository (this assumes you want to put the code in a directory called <code>googlecrisismap</code>):<br>
<pre><code>hg clone https://code.google.com/p/googlecrisismap<br>
</code></pre></li></ul>

Questions about Mercurial?  Check out the <a href='http://mercurial.selenic.com/wiki/QuickStart'>quickstart guide</a>.<br>
<br>
<h3>Step 3. Build the app</h3>

Go into the <code>googlecrisismap</code> directory you created in Step 2 and type <code>make</code>.<br>
<br>
<h3>Step 4. Test the app</h3>

To run all the tests: <code>make test</code>

You can run a single JS test continuously (~3-4 times per second) while you edit.  For example: <code>tools/ctest map_model_test</code>

<h3>Step 5. Try the app!</h3>

<ul><li>Type: <code>tools/run</code> or, if you have made code changes, rebuild and run by typing <code>make run</code></li></ul>

<ul><li>Visit <a href='http://localhost:8000/maps'>http://localhost:8000/maps</a> in a browser.</li></ul>

<ul><li>The first time you visit the page, you will see a list of test sign-in options. Choose either an 'alpha.test' or 'beta.test' user and click 'Sign in'.</li></ul>

<ul><li>Dismiss the welcome pop-up.</li></ul>

<ul><li>You will need to set up a domain before you can create a map. Click the 'Create domain alpha.test' (or beta.test) link in the left navigation bar. Alternatively, you can click the red 'Create map' button and then click the 'Setup alpha.test' (or beta.test) button.</li></ul>

<ul><li>Click 'OK' on the domain administration popup.</li></ul>

<ul><li>Click 'Create map' to start editing a new map.