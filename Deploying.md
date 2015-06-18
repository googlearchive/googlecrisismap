### Step 1. Create a new app ###

Go to http://appspot.com/ and click "Create Application".  Choose an **application ID** for your application and fill out the form.

<br>
<h3>Step 2. Get the App Engine SDK</h3>

On the <a href='https://developers.google.com/appengine/downloads'>App Engine Downloads</a> page, download and install the SDK package for your platform.<br>
<br>
<br>
<h3>Step 3. Get the code</h3>

Download the latest zip file from the <a href='https://drive.google.com/#folders/0Bx3lspqM75QyUm45VjAzal83N0E'>Downloads</a> folder for this project.  Unzip the file.<br>
<br>
<br>
<h3>Step 4. Deploy the code to your app</h3>

Open a terminal window and use the <code>cd</code> command to go into the <code>googlecrisismap-</code><var>NNN</var> directory that was just unzipped.  Then type:<br>
<br>
<pre><code>appcfg.py update . -A APP_ID</code></pre>

(Replace APP_ID with your application ID.)<br>
<br>
<br>
<h3>Step 5. Wait for indexes to build</h3>

Visit <a href='http://appspot.com/'>http://appspot.com/</a>, select your app, and click "Datastore Indexes" on the left.  Wait until all the indexes have "Serving" in the "Status" column before proceeding.<br>
<br>
<br>
<h3>Step 6. Grant yourself administrator access</h3>

In order to create maps or allow other users to create maps, you'll need to execute some commands in the console.  Type:<br>
<br>
<pre><code>tools/console APP_ID.appspot.com</code></pre>

(Replace APP_ID with your application ID.)<br>
<br>
and then log in with the e-mail address and password of the Google Account that you used to create the application in step 1.  Once you are logged in, enter these two commands:<br>
<br>
<pre><code>domains.Domain.Create('gmail.com')</code></pre>

<pre><code>Grant(users.GetForEmail('YOUR_EMAIL').id, 'DOMAIN_ADMIN', 'gmail.com')</code></pre>

Replace YOUR_EMAIL with the e-mail address of your Google Account.<br>
<br>
<br>
<h3>Step 7. Try your app</h3>

To get started, go to: <a href='http://APP_ID.appspot.com/.maps'>http://APP_ID.appspot.com/.maps</a>

(Replace APP_ID with your application ID.)<br>
<br>
You should now be able to create, edit, and publish maps, as long as you are logged in using the same Google Account that you used in Step 6.