// Papaya build script (replaces the former Java based papaya-builder.jar + Closure Compiler).
//
// usage: npm run build -- [options]   (or: node scripts/build.mjs [options])
//
// Output is written in build/ : papaya.js, papaya.css, index.html (+ data/ when images are included)

import { transform } from 'esbuild';
import { parseArgs } from 'node:util';
import { copyFile, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUTPUT_DIR = 'build';
const OUTPUT_JS_FILENAME = 'papaya.js';
const OUTPUT_CSS_FILENAME = 'papaya.css';
const BUILD_PROP_FILE = 'build.properties';
const HTML_TEMPLATE_FILE = 'scripts/index.html';

const SAMPLE_IMAGE_NII_FILE = 'tests/data/sample_image.nii.gz';
const SAMPLE_DEFAULT_ATLAS_FILE = 'tests/data/Talairach.xml';

const JS_FILE_JQUERY = 'lib/jquery.js';
const JS_FILE_DAIKON = 'lib/daikon.js';

const JS_FILES = [
    'lib/base64-binary.js',
    'lib/bowser.js',
    'lib/numerics.js',
    'lib/pako-inflate.js',
    'lib/nifti-reader.js',
    'lib/gifti-reader.js',
    'lib/gl-matrix.js',
    'lib/GLU.js',
    'lib/xss.js',
    'src/js/constants.js',
    'src/js/utilities/array-utils.js',
    'src/js/utilities/math-utils.js',
    'src/js/utilities/object-utils.js',
    'src/js/utilities/platform-utils.js',
    'src/js/utilities/string-utils.js',
    'src/js/utilities/url-utils.js',
    'src/js/core/coordinate.js',
    'src/js/core/point.js',
    'src/js/volume/header.js',
    'src/js/volume/imagedata.js',
    'src/js/volume/imagedescription.js',
    'src/js/volume/imagedimensions.js',
    'src/js/volume/imagerange.js',
    'src/js/volume/imagetype.js',
    'src/js/volume/nifti/header-nifti.js',
    'src/js/volume/dicom/header-dicom.js',
    'src/js/volume/orientation.js',
    'src/js/volume/transform.js',
    'src/js/volume/volume.js',
    'src/js/volume/voxeldimensions.js',
    'src/js/volume/voxelvalue.js',
    'src/js/surface/surface.js',
    'src/js/surface/surface-gifti.js',
    'src/js/surface/surface-mango.js',
    'src/js/surface/surface-vtk.js',
    'src/js/ui/dialog.js',
    'src/js/ui/menu.js',
    'src/js/ui/menuitem.js',
    'src/js/ui/menuitemcheckbox.js',
    'src/js/ui/menuitemradiobutton.js',
    'src/js/ui/menuitemfilechooser.js',
    'src/js/ui/menuitemrange.js',
    'src/js/ui/menuitemslider.js',
    'src/js/ui/menuitemspacer.js',
    'src/js/ui/toolbar.js',
    'src/js/viewer/atlas.js',
    'src/js/viewer/colortable.js',
    'src/js/viewer/display.js',
    'src/js/viewer/preferences.js',
    'src/js/viewer/screenslice.js',
    'src/js/viewer/screenvol.js',
    'src/js/viewer/viewer.js',
    'src/js/viewer/screensurface.js',
];
// image tools (measurement, cine...) are optional, they are enabled by the "imageTools" viewer parameter
const JS_FILES_TOOLS = ['src/js/viewer/viewerTools.js'];
const JS_FILE_MAIN = 'src/js/main.js';

const CSS_FILES = [
    'src/css/base.css',
    'src/css/ui/toolbar.css',
    'src/css/ui/menu.css',
    'src/css/ui/dialog.css',
    'src/css/utilities/nojs.css',
    'src/css/utilities/unsupported.css',
    'src/css/viewer/viewer.css',
];
const CSS_FILES_TOOLS = ['src/css/sidenav.css'];

// stylesheet required by image tools icons
const FONT_AWESOME_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css';
const JQUERY_CDN = 'https://code.jquery.com/jquery-4.0.0.min.js';

const ESBUILD_TARGET = 'es2020';

const HELP = `usage: npm run build -- [options]

  --sample                 include sample image
  --atlas [file]           add atlas (default atlas if no arg)
  --images <files...>      images to include
  --surfaces <files...>    surfaces to include
  --local                  build for local usage (images are embedded in papaya.js)
  --singlefile             output a single HTML file
  --nojquery               do not include jQuery library
  --nodicom                do not include DICOM support
  --tools                  include image tools (requires Font Awesome stylesheet)
  --parameterfile <file>   specify parameters
  --title <text>           add a title
  --footnote <text>        add a footnote
  --noincrement            do not increment build number
  --root <dir>             papaya project directory
  --help                   print this message
`;


/** collect values of options accepting several arguments (e.g. --images a.nii b.nii) */
const collectMultiValues = (args, names) => {
    const values = Object.fromEntries(names.map((name) => [name, []]));
    const remaining = [];
    let current = null;
    for (const arg of args) {
        if (arg.startsWith('--')) {
            current = names.includes(arg.slice(2)) ? arg.slice(2) : null;
            if (!current) {
                remaining.push(arg);
            }
        } else if (current) {
            values[current].push(arg);
        } else {
            remaining.push(arg);
        }
    }
    return { values, remaining };
};

const parseCli = (argv) => {
    const { values: multi, remaining } = collectMultiValues(argv, ['images', 'surfaces']);

    //--atlas has an optional value
    const atlasIndex = remaining.indexOf('--atlas');
    let atlas = null;
    if (atlasIndex !== -1) {
        const next = remaining[atlasIndex + 1];
        atlas = (next && !next.startsWith('--')) ? next : true;
        remaining.splice(atlasIndex, (atlas === true) ? 1 : 2);
    }

    const { values } = parseArgs({
        args: remaining,
        options: {
            sample: { type: 'boolean' },
            local: { type: 'boolean' },
            singlefile: { type: 'boolean' },
            nojquery: { type: 'boolean' },
            nodicom: { type: 'boolean' },
            tools: { type: 'boolean' },
            parameterfile: { type: 'string' },
            title: { type: 'string' },
            footnote: { type: 'string' },
            noincrement: { type: 'boolean' },
            root: { type: 'string' },
            help: { type: 'boolean' },
        },
        strict: true,
    });

    return { ...values, atlas, images: multi.images, surfaces: multi.surfaces };
};

const removeNiftiExtensions = (str) => {
    if (str.endsWith('.gz')) {
        str = str.substring(0, str.indexOf('.gz'));
    }
    if (str.endsWith('.nii')) {
        str = str.substring(0, str.indexOf('.nii'));
    }
    return str;
};

const replaceNonAlphanumericCharacters = (str) => str.replace(/[^A-Za-z0-9]/g, '_');

const cleanText = (str) => {
    if (typeof str !== 'string') {
        return null;
    }
    str = str.trim().replaceAll('"', '').replaceAll("'", '');
    return str.length > 0 ? str : null;
};

const encodeImageFile = async (file) => (await readFile(file)).toString('base64');


// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// Atlas XML to JSON conversion

const decodeXmlEntities = (str) => str
    .replace(/&#x([0-9a-fA-F]+);/g, (m, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (m, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

/** minimal XML parser producing the same structure as org.json XML.toJSONObject (used by the former builder) */
const xmlToJson = (xml) => {
    xml = xml
        .replace(/<\?[\s\S]*?\?>/g, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<!DOCTYPE[\s\S]*?>/gi, '');

    const root = { children: {} };
    const stack = [root];
    const tagRegex = /<(\/?)([^\s/>]+)([^>]*?)(\/?)>|([^<]+)/g;
    let match;

    const addChild = (parent, name, value) => {
        if (Object.hasOwn(parent.children, name)) {
            const existing = parent.children[name];
            parent.children[name] = Array.isArray(existing) ? [...existing, value] : [existing, value];
        } else {
            parent.children[name] = value;
        }
    };

    const finalize = (node) => {
        const keys = Object.keys(node.children);
        if (keys.length === 0 && Object.keys(node.attributes).length === 0) {
            return node.text;
        }
        const obj = { ...node.attributes, ...node.children };
        if (node.text.trim().length > 0) {
            obj.content = node.text;
        }
        return obj;
    };

    while ((match = tagRegex.exec(xml)) !== null) {
        const [, closing, name, attrs, selfClosing, text] = match;
        const current = stack[stack.length - 1];

        if (text !== undefined) {
            if (current !== root) {
                current.text += decodeXmlEntities(text);
            }
        } else if (closing) {
            const node = stack.pop();
            if (node.name !== name) {
                throw new Error(`Malformed XML: unexpected </${name}>`);
            }
            addChild(stack[stack.length - 1], name, finalize(node));
        } else {
            const attributes = {};
            for (const [, key, , value] of attrs.matchAll(/([^\s=]+)\s*=\s*(["'])(.*?)\2/g)) {
                attributes[key] = decodeXmlEntities(value);
            }
            const node = { name, attributes, children: {}, text: '' };
            if (selfClosing) {
                addChild(current, name, finalize(node));
            } else {
                stack.push(node);
            }
        }
    }

    return root.children;
};

const readXmlFile = async (file) => {
    const buffer = await readFile(file);
    const declaration = buffer.subarray(0, 200).toString('latin1');
    const encoding = /encoding=["']ISO-8859-1["']/i.test(declaration) ? 'latin1' : 'utf8';
    return buffer.toString(encoding);
};

const createAtlas = async (xmlFile, local) => {
    const json = xmlToJson(await readXmlFile(xmlFile));
    const header = json.atlas.header;
    const parentDir = path.dirname(xmlFile);

    //use the smallest summary image when several images are declared
    let imageFile = null;
    const images = Array.isArray(header.images) ? header.images : [header.images];
    let smallest = Number.MAX_SAFE_INTEGER;
    for (const image of images) {
        const file = path.join(parentDir, `${image.summaryimagefile}.nii.gz`);
        const size = (await stat(file)).size;
        if (size < smallest) {
            imageFile = file;
            smallest = size;
        }
    }

    const imageFileNewName = replaceNonAlphanumericCharacters(removeNiftiExtensions(path.basename(imageFile)));
    header.images = { summaryimagefile: imageFileNewName };

    //labels are expected to be an array, even if there is a single one
    if (json.atlas.data && json.atlas.data.label !== undefined && !Array.isArray(json.atlas.data.label)) {
        json.atlas.data.label = [json.atlas.data.label];
    }

    let js = '';
    if (local) {
        js += `var ${imageFileNewName}="${await encodeImageFile(imageFile)}";\n`;
    }
    js += '"use strict";var papaya = papaya || {};papaya.data = papaya.data || {};papaya.data.Atlas = papaya.data.Atlas || {};'
        + `papaya.data.Atlas.labels=${JSON.stringify(json)};\n`;

    return { js, imageFile, imageFileNewName };
};


// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// HTML

const writeHtml = async (outputDir, opts) => {
    const { buildNumber, params, title, footnote, nojquery, tools, useTitleOrFootnote, js, css } = opts;
    let html = await readFile(path.join(opts.projectDir, HTML_TEMPLATE_FILE), 'utf8');

    const paramsBlock = `<script type="text/javascript">\n${params ?? 'var params = [];'}\n</script>\n`;
    const titleBlock = title ? `<h3 style="text-align:center;font-family:sans-serif">${title}</h3>` : '';
    const footnoteBlock = footnote ? `<p style="width:55%;margin:10px auto;text-align:center;font-family:sans-serif">${footnote}</p>` : '';
    const papayaBlock = useTitleOrFootnote
        ? '<div style="width:55%;margin:auto;text-align:center;"><div class="papaya" data-params="params"></div></div>'
        : '<div class="papaya" data-params="params"></div>';

    let cssBlock = tools ? `<link rel="stylesheet" href="${FONT_AWESOME_CSS}" crossorigin="anonymous" referrerpolicy="no-referrer" />\n` : '';
    cssBlock += css
        ? `<style type="text/css">\n${css}\n</style>\n`
        : `<link rel="stylesheet" type="text/css" href="${OUTPUT_CSS_FILENAME}?build=${buildNumber}" />`;

    let jsBlock = nojquery ? `<script src="${JQUERY_CDN}"></script>\n` : '';
    jsBlock += js
        ? `<script type="text/javascript">\n${js}\n</script>\n`
        : `<script type="text/javascript" src="${OUTPUT_JS_FILENAME}?build=${buildNumber}"></script>`;

    html = html
        .replace('<!-- PARAMS GO HERE -->', () => paramsBlock)
        .replace('<!-- TITLE GOES HERE -->', () => titleBlock)
        .replace('<!-- PAPAYA GOES HERE -->', () => papayaBlock)
        .replace('<!-- FOOTNOTE GOES HERE -->', () => footnoteBlock)
        .replace('<!-- CSS GOES HERE -->', () => cssBlock)
        .replace('<!-- JS GOES HERE -->', () => jsBlock);

    await writeFile(path.join(outputDir, 'index.html'), html);
};


// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

const concatenateFiles = async (projectDir, files) => {
    const contents = await Promise.all(files.map((file) => readFile(path.join(projectDir, file), 'utf8')));
    return contents.map((content) => content + '\n').join('');
};

const readBuildNumber = async (file) => {
    const content = await readFile(file, 'utf8');
    const match = content.match(/PAPAYA_BUILD_NUM\s*=\s*"(\d+)"/);
    if (!match) {
        throw new Error(`Could not read build number from ${file}`);
    }
    return parseInt(match[1], 10);
};

const main = async () => {
    const args = parseCli(process.argv.slice(2));
    if (args.help) {
        console.log(HELP);
        return;
    }

    const projectDir = args.root
        ? path.resolve(args.root)
        : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const outputDir = path.join(projectDir, OUTPUT_DIR);

    console.log('Cleaning output directory...');
    await rm(outputDir, { recursive: true, force: true });
    await mkdir(outputDir, { recursive: true });

    if (args.local) {
        console.log('Building for local usage...');
    }

    const buildPropFile = path.join(projectDir, BUILD_PROP_FILE);
    let buildNumber = await readBuildNumber(buildPropFile);
    if (!args.noincrement) {
        buildNumber += 1;
        await writeFile(buildPropFile, `PAPAYA_BUILD_NUM="${buildNumber}";\n`);
    }

    let params = null;
    if (args.parameterfile) {
        console.log('Including parameters...');
        params = `var params = ${await readFile(args.parameterfile, 'utf8')};`;
    }

    let title = cleanText(args.title);
    if (title) {
        console.log(`Using title: ${title}`);
    } else if (args.footnote !== undefined) {
        title = '&nbsp;';
    }
    const footnote = cleanText(args.footnote);
    if (footnote) {
        console.log(`Using footnote: ${footnote}`);
    }

    //code inserted before the library & papaya code (build number, embedded images, atlas)
    let preamble = `var PAPAYA_BUILD_NUM="${buildNumber}";\n`;
    const loadableImages = [];

    const includeImage = async (file, entry) => {
        const name = replaceNonAlphanumericCharacters(removeNiftiExtensions(path.basename(file)));
        if (args.local) {
            loadableImages.push({ ...entry, name, encode: name });
            preamble += `var ${name}= "${await encodeImageFile(file)}";\n`;
        } else {
            const url = entry.url ?? `data/${path.basename(file)}`;
            loadableImages.push({ ...entry, name, url });
            await mkdir(path.dirname(path.join(outputDir, url)), { recursive: true });
            await copyFile(file, path.join(outputDir, url));
        }
    };

    if (args.sample) {
        console.log('Including sample image...');
        await includeImage(path.join(projectDir, SAMPLE_IMAGE_NII_FILE), { nicename: 'Sample Image', url: args.local ? undefined : SAMPLE_IMAGE_NII_FILE });
    }

    if (args.atlas) {
        const atlasXmlFile = (args.atlas === true) ? path.join(projectDir, SAMPLE_DEFAULT_ATLAS_FILE) : path.resolve(args.atlas);
        console.log(`Including atlas ${atlasXmlFile}`);
        const atlas = await createAtlas(atlasXmlFile, args.local);
        console.log(`Using atlas image file ${atlas.imageFile}`);
        if (args.local) {
            loadableImages.push({ nicename: 'Atlas', name: atlas.imageFileNewName, encode: atlas.imageFileNewName, hide: true });
        } else {
            const atlasPath = `data/${path.basename(atlas.imageFile)}`;
            loadableImages.push({ nicename: 'Atlas', name: atlas.imageFileNewName, url: atlasPath, hide: true });
            await mkdir(path.join(outputDir, 'data'), { recursive: true });
            await copyFile(atlas.imageFile, path.join(outputDir, atlasPath));
        }
        preamble += atlas.js;
    }

    for (const file of args.images) {
        console.log(`Including image ${file}`);
        await includeImage(file, { nicename: removeNiftiExtensions(path.basename(file)) });
    }

    for (const file of args.surfaces) {
        console.log(`Including surface ${file}`);
        await includeImage(file, { nicename: removeNiftiExtensions(path.basename(file)), surface: true });
    }

    const jsFiles = [
        ...(args.nojquery ? [] : [JS_FILE_JQUERY]),
        ...(args.nodicom ? [] : [JS_FILE_DAIKON]),
        ...JS_FILES,
        ...(args.tools ? JS_FILES_TOOLS : []),
        JS_FILE_MAIN,
    ];
    const cssFiles = [...CSS_FILES, ...(args.tools ? CSS_FILES_TOOLS : [])];

    console.log('Compressing JavaScript...');
    const jsSource = preamble
        + `var papayaLoadableImages = ${JSON.stringify(loadableImages)};\n`
        + await concatenateFiles(projectDir, jsFiles);
    const { code: js } = await transform(jsSource, {
        loader: 'js',
        minify: true,
        target: ESBUILD_TARGET,
        //keep third-party license comments
        legalComments: 'eof',
        logLevel: 'error',
    });

    console.log('Compressing CSS...');
    const { code: css } = await transform(await concatenateFiles(projectDir, cssFiles), {
        loader: 'css',
        minify: true,
        legalComments: 'none',
        logLevel: 'error',
    });

    console.log('Writing HTML...');
    const htmlOpts = {
        projectDir, buildNumber, params, title, footnote,
        nojquery: args.nojquery, tools: args.tools,
        useTitleOrFootnote: (args.title !== undefined) || (args.footnote !== undefined),
    };
    if (args.singlefile) {
        await writeHtml(outputDir, { ...htmlOpts, js, css });
    } else {
        await writeFile(path.join(outputDir, OUTPUT_JS_FILENAME), js);
        await writeFile(path.join(outputDir, OUTPUT_CSS_FILENAME), css);
        await writeHtml(outputDir, htmlOpts);
    }

    console.log(`Done!  Build ${buildNumber}, see ${OUTPUT_DIR} folder for output...`);
};

main().catch((error) => {
    console.error(error.message ?? error);
    process.exit(1);
});
