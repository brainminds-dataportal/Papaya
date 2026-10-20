Papaya 
======
Papaya is a pure JavaScript medical research image viewer, supporting [DICOM and NIFTI formats](https://github.com/rii-mango/Papaya/wiki/Supported-Formats), compatible across a [range of web browsers](https://github.com/rii-mango/Papaya/wiki/Requirements).  This orthogonal viewer supports [overlays](https://github.com/rii-mango/Papaya/wiki/Configuration#images), [atlases](https://github.com/rii-mango/Papaya/wiki/How-To-Use-Atlases), [GIFTI & VTK surface data](https://github.com/rii-mango/Papaya/wiki/Configuration#surfaces) and [DTI data](https://github.com/rii-mango/Papaya/wiki/Configuration#dti).  The Papaya UI is [configurable](https://github.com/rii-mango/Papaya/wiki/Configuration) with many [display, menu and control options](https://github.com/rii-mango/Papaya/wiki/Configuration#display-parameters) and can be run on a [web server or as a local, shareable file](https://github.com/rii-mango/Papaya/wiki/How-To-Build-Papaya).

![ScreenShot](https://raw.github.com/rii-mango/Papaya/master/docs/images/splash1.png)&nbsp;&nbsp;&nbsp;![ScreenShot](https://raw.github.com/rii-mango/Papaya/master/docs/images/splash2.png)

### [Documentation](https://github.com/rii-mango/Papaya/wiki) & [Demo](http://rii.uthscsa.edu/mango/papaya/)
* [Requirements](https://github.com/rii-mango/Papaya/wiki/Requirements): Firefox (7+), Chrome (7+), Safari (6+), iOS (6+), IE (10+), Edge (12+)
* [Supported Formats](https://github.com/rii-mango/Papaya/wiki/Supported-Formats): NIFTI (.nii, .nii.gz), DICOM (compressed/uncompressed), GIFTI (.surf.gii), VTK

Quickstart Guide
------
> **Note:** this is the [Brain/MINDS data portal](https://dataportal.brainminds.jp/) fork of [rii-mango/Papaya](https://github.com/rii-mango/Papaya),
> maintained on the `brainminds-dataportal` branch (`master` mirrors upstream).

### Requirements
Node.js 18+ (build tools only; the Java based builder has been replaced by a Node.js script using [esbuild](https://esbuild.github.io/)).

```sh
npm install
```

### Development
Run `npm start`, then open http://127.0.0.1:8000/tests/debug_local.html or http://127.0.0.1:8000/tests/debug_server.html in your browser.

### [Building](https://github.com/rii-mango/Papaya/wiki/How-To-Build-Papaya)
See [here](release/current) for the latest release or run `npm run build` to create your own build in the `build/` folder.
Options are passed after `--`, e.g. `npm run build -- --nodicom --sample` (see `npm run build -- --help`):

| option | description |
|---|---|
| `--sample` | include sample image |
| `--atlas [file]` | add atlas (default atlas if no arg) |
| `--images <files...>` / `--surfaces <files...>` | images / surfaces to include |
| `--local` | build for local usage (images are embedded in papaya.js) |
| `--singlefile` | output a single HTML file |
| `--nojquery` | do not include jQuery library |
| `--nodicom` | do not include DICOM support |
| `--tools` | include image tools (`imageTools` parameter; requires [Font Awesome](https://fontawesome.com/) stylesheet) |
| `--parameterfile <file>` / `--title <text>` / `--footnote <text>` | customize the generated `index.html` |
| `--noincrement` | do not increment build number |

`npm run release` rebuilds all the variants in `release/current/`.

### [Usage](https://github.com/rii-mango/Papaya/wiki/Usage) & [Configuration](https://github.com/rii-mango/Papaya/wiki/Configuration)

#### Basic usage (loads a blank viewer)
```html
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
    <head>
        <link rel="stylesheet" type="text/css" href="papaya.css" />
        <script type="text/javascript" src="papaya.js"></script>
        <title>Papaya Viewer</title>
    </head>

    <body>
        <div class="papaya"></div>
    </body>
</html>
```

#### To automatically load images and configure other options
```html
<head>
    ...
    <script type="text/javascript">
        var params = [];
        params["worldSpace"] = true;
        params["images"] = ["data/myBaseImage.nii.gz", "data/myOverlayImage.nii.gz"];
        params["surfaces"] = ["data/mySurface.surf.gii"];
        params["myOverlayImage.nii.gz"] = {"min": 4, "max": 10};
    </script>
</head>

...

<div class="papaya" data-params="params"></div>

```
#### To automatically load images and configure other options with Tools like Zoom,PAN,STACK and Magnify
```html
<head>
   <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"/>
   <script type="text/javascript" src="papaya.js"></script> <!-- built with: npm run build -- --tools -->
    ...
    <script type="text/javascript">
        var params = [];
        params["imageTools"] = true;
        params["images"] = ["data/myBaseImage.nii.gz", "data/myOverlayImage.nii.gz"];
        params["surfaces"] = ["data/mySurface.surf.gii"];
        params["myOverlayImage.nii.gz"] = {"min": 4, "max": 10};
    </script>
</head>
...

<div class="papaya" data-params="params"></div>
```
**Rectangle**
![image](https://github.com/rii-mango/Papaya/assets/11830418/2ea61e9e-f1ec-43dc-865c-b9ac917de0f1)

**Play Cine**
![image](https://github.com/rii-mango/Papaya/assets/11830418/8d63e9e2-a666-4b86-b802-99e3d144fc4a)

**Magnify**
![image](https://github.com/rii-mango/Papaya/assets/11830418/025c5fc1-b5a4-41cb-ada8-6ab861e61e38)

**Ruler**
![image](https://github.com/rii-mango/Papaya/assets/11830418/c84385e1-0007-44e8-9b9e-76697ed0ebc9)

**Angle**
![image](https://github.com/rii-mango/Papaya/assets/11830418/04dbcfb3-fd3f-4a0b-9a93-3e4d2eff2ccd)

**Ellipse**
![image](https://github.com/rii-mango/Papaya/assets/11830418/f245c669-3d90-4d27-af0b-90fb9ca85fe2)


Acknowledgments
-----
Papaya uses:
- [Daikon](https://github.com/rii-mango/Daikon) for DICOM support
- [NIFTI-Reader-JS](https://github.com/rii-mango/NIFTI-Reader-JS) for NIFTI support 
- [GIFTI-Reader-JS](https://github.com/rii-mango/GIFTI-Reader-JS) for GIFTI support 

As well as the following third-party libraries:
- [bowser](https://github.com/ded/bowser) &mdash; for browser detection
- [esbuild](https://esbuild.github.io/) &mdash; JavaScript & CSS compression
- [jquery](http://jquery.com/) &mdash; DOM manipulation
- [numerics](http://numericjs.com/) &mdash; for matrix math
- [pako](https://github.com/nodeca/pako) &mdash; for GZIP inflating
