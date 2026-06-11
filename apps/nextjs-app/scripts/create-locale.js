const fs = require('fs');
const path = require('path');

function printUsage() {
  console.log(`
Usage: yarn create-locale <locale-code> [--copy]

Arguments:
  <locale-code>  The ISO 2-letter code for the new language (e.g., de, fr, it)
  --copy         (Optional) Copy all English text as placeholders instead of empty strings.
`);
}

// 1. Load env vars from .env.local
function loadEnvLocal() {
  const envPath = path.join(__dirname, '../.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    const lines = content.split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)$/);
      if (match) {
        const key = match[1].trim();
        let val = match[2].trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.substring(1, val.length - 1);
        }
        process.env[key] = val;
      }
    }
  }
}

loadEnvLocal();

const args = process.argv.slice(2);
const locale = args[0];
const copyValues = args.includes('--copy');

if (!locale || locale.startsWith('-') || locale.length !== 2) {
  console.error('Error: Please specify a valid 2-letter locale code.');
  printUsage();
  process.exit(1);
}

const messagesDir = path.join(__dirname, '../messages');
const sourcePath = path.join(messagesDir, 'en.json');
const targetPath = path.join(messagesDir, `${locale}.json`);
const localesConfigPath = path.join(__dirname, '../i18n/locales.json');

if (!fs.existsSync(sourcePath)) {
  console.error(`Error: Base English messages file not found at ${sourcePath}`);
  process.exit(1);
}

if (!fs.existsSync(localesConfigPath)) {
  console.error(`Error: Locales configuration file not found at ${localesConfigPath}`);
  process.exit(1);
}

console.log(`\n------------------------------------------------------`);
console.log(`Step 1: Creating/merging locale file for: ${locale}`);
console.log(`------------------------------------------------------`);

let sourceData;
try {
  sourceData = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
} catch (err) {
  console.error('Error parsing en.json:', err);
  process.exit(1);
}

let targetData = {};
if (fs.existsSync(targetPath)) {
  console.log(`Found existing target locale file at ${targetPath}. Merging new keys...`);
  try {
    targetData = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
  } catch (err) {
    console.error(`Error parsing existing ${locale}.json:`, err);
    process.exit(1);
  }
}

// Helper to recursively merge/build the target object
function buildLocaleTree(source, target = {}) {
  const result = {};
  for (const key in source) {
    if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
      result[key] = buildLocaleTree(source[key], target[key] || {});
    } else {
      if (target[key] !== undefined && target[key] !== '') {
        result[key] = target[key];
      } else {
        result[key] = copyValues ? source[key] : '';
      }
    }
  }
  return result;
}

const finalData = buildLocaleTree(sourceData, targetData);

try {
  fs.writeFileSync(targetPath, JSON.stringify(finalData, null, 2) + '\n', 'utf8');
  console.log(`Success: Translation file created/updated at:`);
  console.log(`  -> ${targetPath}`);
} catch (err) {
  console.error(`Error writing target file:`, err);
  process.exit(1);
}

console.log(`\n------------------------------------------------------`);
console.log(`Step 2: Updating locales configuration and options`);
console.log(`------------------------------------------------------`);

// 1. Update locales.json locales list
let localesConfig;
try {
  localesConfig = JSON.parse(fs.readFileSync(localesConfigPath, 'utf8'));
  const files = fs.readdirSync(messagesDir);
  const discoveredLocales = files
    .filter((file) => file.endsWith('.json'))
    .map((file) => path.basename(file, '.json'))
    .sort();

  localesConfig.locales = discoveredLocales;
  
  // Ensure the new locale code is registered in labels if not present
  if (!localesConfig.labels[locale]) {
    try {
      const nativeDisplay = new Intl.DisplayNames([locale], { type: 'language' });
      const nativeName = nativeDisplay.of(locale);
      localesConfig.labels[locale] = nativeName.charAt(0).toUpperCase() + nativeName.slice(1);
    } catch (e) {
      localesConfig.labels[locale] = locale.toUpperCase();
    }
  }
  
  fs.writeFileSync(localesConfigPath, JSON.stringify(localesConfig, null, 2) + '\n', 'utf8');
  console.log(`Updated dynamic locales list in i18n/locales.json.`);
  console.log(`  -> Active locales: ${discoveredLocales.join(', ')}`);
} catch (err) {
  console.error(`Error updating locales.json:`, err);
}

// 2. Automatically populate language option names in all translation catalog files
console.log(`Populating localized option labels under AccountSettings.language.${locale} in all catalogs...`);
const catalogFiles = fs.readdirSync(messagesDir).filter(file => file.endsWith('.json'));

for (const file of catalogFiles) {
  const filePath = path.join(messagesDir, file);
  const langCode = path.basename(file, '.json');
  
  try {
    const catalog = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (catalog.AccountSettings && catalog.AccountSettings.language) {
      // Resolve the display name of the new locale in the catalog's language
      let resolvedName = '';
      try {
        const displayNames = new Intl.DisplayNames([langCode], { type: 'language' });
        const localName = displayNames.of(locale);
        const capitalizedLocalName = localName.charAt(0).toUpperCase() + localName.slice(1);
        
        let nativeName = '';
        try {
          const nativeDisplay = new Intl.DisplayNames([locale], { type: 'language' });
          const nativeN = nativeDisplay.of(locale);
          nativeName = nativeN.charAt(0).toUpperCase() + nativeN.slice(1);
        } catch (e) {}
        
        if (nativeName && nativeName !== capitalizedLocalName) {
          resolvedName = `${capitalizedLocalName} (${nativeName})`;
        } else {
          resolvedName = capitalizedLocalName;
        }
      } catch (e) {
        resolvedName = localesConfig.labels[locale] || locale.toUpperCase();
      }
      
      catalog.AccountSettings.language[locale] = resolvedName;
      fs.writeFileSync(filePath, JSON.stringify(catalog, null, 2) + '\n', 'utf8');
      console.log(`  -> Updated AccountSettings.language.${locale} = "${resolvedName}" in ${file}`);
    }
  } catch (err) {
    console.error(`Error updating options in ${file}:`, err.message);
  }
}

// Helper to check for OpenAI key
const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.log(`\n------------------------------------------------------`);
  console.log(`Skipping Automatic Translation`);
  console.log(`------------------------------------------------------`);
  console.log(`OPENAI_API_KEY is not defined in environment or .env.local.`);
  console.log(`To automatically translate all strings, set the API key and run the script again.`);
  process.exit(0);
}

console.log(`\n------------------------------------------------------`);
console.log(`Step 3: Translating missing strings to "${locale}" using OpenAI`);
console.log(`------------------------------------------------------`);

// Flatten the JSON to get path-value pairs for translation
function flattenJson(obj, prefix = '', res = {}) {
  for (const key in obj) {
    const propName = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      flattenJson(obj[key], propName, res);
    } else if (typeof obj[key] === 'string') {
      res[propName] = obj[key];
    }
  }
  return res;
}

// Helper to set nested value
function setNestedValue(obj, pathStr, value) {
  const parts = pathStr.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!current[part]) current[part] = {};
    current = current[part];
  }
  current[parts[parts.length - 1]] = value;
}

async function translateBatch(batch) {
  const promptObj = {};
  for (const item of batch) {
    promptObj[item.path] = item.value;
  }
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are a professional UX translator translating interface strings from English to the language with locale code "${locale}". Translate the values of the JSON object. Keep variables (like {count}, {date}, {minutes}, {year}), ICU plurals (like {count, plural, ...}), HTML/custom tags (like <bold>, <emailLink>, <privacy>), and symbols completely intact. Return only the translated JSON object with the exact same keys.`
        },
        {
          role: 'user',
          content: JSON.stringify(promptObj)
        }
      ],
      temperature: 0.1
    })
  });
  
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI API returned status ${response.status}: ${errText}`);
  }
  
  const result = await response.json();
  const content = JSON.parse(result.choices[0].message.content);
  return content;
}

async function runTranslation() {
  // Reload files to make sure we have the latest
  const enJson = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  const targetJson = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
  
  const flatEn = flattenJson(enJson);
  const flatTarget = flattenJson(targetJson);
  
  // Skip translating language configuration keys
  const skipPrefix = 'AccountSettings.language.';
  
  const toTranslate = [];
  for (const key in flatEn) {
    if (key.startsWith(skipPrefix)) continue;
    
    const enVal = flatEn[key];
    const targetVal = flatTarget[key];
    
    // If the value is empty, or equals the English value, we need to translate it
    if (!targetVal || targetVal === enVal) {
      toTranslate.push({ path: key, value: enVal });
    }
  }
  
  console.log(`Total keys to check: ${Object.keys(flatEn).length}`);
  console.log(`Keys needing translation to "${locale}": ${toTranslate.length}`);
  
  if (toTranslate.length === 0) {
    console.log('All keys are already translated!');
    return;
  }
  
  const BATCH_SIZE = 80;
  let count = 0;
  
  for (let i = 0; i < toTranslate.length; i += BATCH_SIZE) {
    const batch = toTranslate.slice(i, i + BATCH_SIZE);
    console.log(`Translating batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(toTranslate.length / BATCH_SIZE)} (${batch.length} keys)...`);
    
    try {
      const translations = await translateBatch(batch);
      
      for (const key in translations) {
        setNestedValue(targetJson, key, translations[key]);
        count++;
      }
      
      // Save progress to target file immediately
      fs.writeFileSync(targetPath, JSON.stringify(targetJson, null, 2) + '\n', 'utf8');
      console.log(`Progress saved. Translated ${count} keys so far.`);
      
      // Brief sleep for rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (err) {
      console.error('Error translating batch:', err.message);
      console.log('Stopping translation phase. You can re-run the script to resume translating remaining keys.');
      process.exit(1);
    }
  }
  
  console.log(`\nSuccess: Automatically translated all ${count} keys to "${locale}"!`);
}

runTranslation();
