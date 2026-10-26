const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');
const code=ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname,'../lib/registration.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;const mod={exports:{}};new Function('exports','module',code)(mod.exports,mod);
test('registration deadline displays only the date',()=>{ assert.equal(mod.exports.formatRegistrationDeadline(new Date(2026,8,17,10,0).toISOString()),'17 Sep 2026'); assert.equal(mod.exports.formatRegistrationDeadline(null),''); assert.equal(mod.exports.formatRegistrationDeadline('bad'),''); });
test('automatic age uses completed whole years',()=>{
 const now = new Date('2025-10-26T12:00:00');
 assert.equal(mod.exports.calculateAgeWithMonths('2018-01-15', now), '7');
 assert.equal(mod.exports.calculateAgeWithMonths('2018-10-27', now), '6');
 assert.equal(mod.exports.calculateAgeWithMonths('2027-01-01', now), null);
});
