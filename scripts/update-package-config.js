const fs = require('fs');
const path = require('path');

const isProduction = process.argv.includes('--production');
const isDevelopment = process.argv.includes('--development') || (!isProduction);
const configFile = isProduction ? 'config.production.json' : 'config.development.json';

console.log(`\n=== Actualizando package.json ===`);
console.log(`Ambiente: ${isProduction ? 'PRODUCCIÓN' : 'DESARROLLO'}`);
console.log(`Archivo de configuración: ${configFile}\n`);

try {
  const configPath = path.join(__dirname, '..', configFile);
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  
  const packagePath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  
  console.log(`appId actual: ${packageJson.build?.appId || 'N/A'}`);
  console.log(`appId objetivo: ${config.build?.appId || 'N/A'}`);
  
  if (!packageJson.build) {
    packageJson.build = {};
  }
  
  if (config.build && config.build.appId) {
    const oldAppId = packageJson.build.appId;
    packageJson.build.appId = config.build.appId;
    console.log(`✓ appId: ${oldAppId} → ${config.build.appId}`);
  }
  
  if (!packageJson.build.win) {
    packageJson.build.win = {};
  }
  
  if (config.build && config.build.artifactName) {
    const oldArtifact = packageJson.build.win.artifactName;
    packageJson.build.win.artifactName = config.build.artifactName;
    console.log(`✓ artifactName: ${oldArtifact || 'N/A'} → ${config.build.artifactName}`);
  }
  
  if (!packageJson.build.publish) {
    packageJson.build.publish = [{ provider: 'generic', url: '' }];
  }
  
  if (!packageJson.build.publish[0]) {
    packageJson.build.publish[0] = { provider: 'generic', url: '' };
  }
  
  if (config.updateUrl) {
    const oldUrl = packageJson.build.publish[0].url;
    packageJson.build.publish[0].url = config.updateUrl;
    packageJson.build.publish[0].provider = 'generic';
    console.log(`✓ updateUrl: ${oldUrl || 'N/A'} → ${config.updateUrl}`);
  }
  
  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2), 'utf8');
  
  // Verificar que se escribió correctamente
  const verifyPackage = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  console.log(`\n✓ package.json actualizado correctamente con configuración de ${configFile}`);
  console.log(`  Verificación - appId en package.json: ${verifyPackage.build?.appId || 'N/A'}`);
  console.log(`  Verificación - artifactName: ${verifyPackage.build?.win?.artifactName || 'N/A'}`);
  console.log(`  Verificación - updateUrl: ${verifyPackage.build?.publish?.[0]?.url || 'N/A'}`);
  
  // Copiar el archivo de configuración como app.config.json para que la app empaquetada lo lea
  const appConfigPath = path.join(__dirname, '..', 'app.config.json');
  fs.copyFileSync(configPath, appConfigPath);
  console.log(`✓ Archivo de configuración copiado como app.config.json (${configFile})\n`);
  
} catch (error) {
  console.error(`Error actualizando package.json:`, error);
  process.exit(1);
}
