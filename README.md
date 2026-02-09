# Iqwebos

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 15.2.11.

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via a platform of your choice. To use this command, you need to first add a package that implements end-to-end testing capabilities.

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.io/cli) page.

## WebOS App Build & Deployment Guide

This guide explains how to build, package, deploy, debug, and uninstall your Angular application on a WebOS device.

## Prerequisites

Before starting, make sure you have:

Node.js & npm – Required for Angular builds.

Angular CLI – To build your Angular project.

WebOS SDK & CLI (ares-cli) – For packaging, installing, and debugging on WebOS.

Connected WebOS device or emulator – Ensure your TV or emulator is reachable.

Verify device connection:

ares-setup-device

## 1. Build Angular App for WebOS

Build the Angular application with production settings:

ng build --output-path=./iqwebos/www --configuration production

This generates all the static files required for WebOS in ./iqwebos/www.

## 2. Navigate to Project Folder

cd ./iqwebos/

## 3. Package the WebOS App

Create a .ipk package:

ares-package ./iqwebos/ --no-minify

--no-minify keeps the source readable for debugging.

This generates a package file like com.smarttv.launchapp\_<version>.ipk.

## 4. Install and Launch the App

Install the app on the device:

ares-install --device tv com.smarttv.launchapp.ipk

Launch the app:

ares-launch --device tv com.smarttv.launchapp

Replace com.smarttv.launchapp with your app’s actual ID.

## 5. Debug & Inspect the App

Inspect and reload the app:

ares-inspect --device tv --reload com.smarttv.launchapp

Opens Web Inspector for debugging JavaScript, CSS, and network requests.

## 6. Update the App

After making changes, rebuild the app:

ng build --output-path=./iqwebos/www --configuration production

Then reinstall and launch:

ares-install --device tv --remove com.smarttv.launchapp
ares-install --device tv com.smarttv.launchapp.ipk
ares-launch --device tv com.smarttv.launchapp

## 7. Uninstall the App (Optional)

To completely remove the app:

ares-install --device tv --remove com.smarttv.launchapp

Tips

Always check device connection before installing or launching.

Keep --no-minify for debugging; use minified builds for production.

Ensure your package name (com.smarttv.launchapp) is consistent across builds.

Combine with Git workflow for version control and team collaboration.

## Angular App Deployment to Tizen OS

This guide explains how to build, package, and deploy an Angular application on Tizen devices.

Prerequisites

Before starting, ensure you have:

Node.js & npm – Required for Angular CLI.

Angular CLI – To build the Angular project.

Tizen Studio – Required for packaging, signing, and deploying apps.

Connected Tizen device or emulator – Ensure your TV or emulator is reachable.

Check connected devices:

tizen device-info

## 1. Build Angular App for Tizen

Build your Angular project and output the files to the Tizen folder:

Production build:
ng build --output-path=./iqtizen/www --configuration production

Tizen-specific build (if defined in angular.json):
ng build --output-path=./iqtizen/www --configuration tizen

This generates all static files needed in ./iqtizen/www.

## 2. Package the Tizen App

Use Tizen Studio or CLI to create a .wgt package:

tizen package -t wgt -s <certificate_profile> -o ./iqtizen/

-t wgt → Package type for Tizen web apps.

-s <certificate_profile> → Your Tizen signing certificate profile.

.wgt file is generated in ./iqtizen/.

## 3. Install the App on Tizen Device

Install the app to a Tizen device:

tizen install --name com.smarttv.launchapp.wgt --target <device_id>

Replace <device_id> with your device ID (tizen device-info).

Replace com.smarttv.launchapp.wgt with your .wgt file name.

## 4. Launch the App

Run the app on the device:

tizen run --name com.smarttv.launchapp --target <device_id>

## 5. Debug & Inspect the App

Use Web Inspector for debugging:

tizen web-launch --target <device_id> --inspect com.smarttv.launchapp

Inspect JavaScript, CSS, and network requests.

## 6. Update or Reinstall the App

After making changes:

Rebuild the app (Step 1).

Repackage the .wgt file (Step 2).

Reinstall and launch (Steps 3 & 4):

tizen install --name com.smarttv.launchapp.wgt --target <device_id> --force
tizen run --name com.smarttv.launchapp --target <device_id>

--force ensures the app is replaced if already installed.

## 7. Uninstall the App (Optional)

tizen uninstall --name com.smarttv.launchapp --target <device_id>

Tips

Always verify device connection before deploying.

Use separate build configurations for development vs production.

Ensure your certificate profile is up to date to avoid signing errors.

Combine with Git workflow for version control.
