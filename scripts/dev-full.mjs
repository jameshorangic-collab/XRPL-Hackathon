import { spawn } from 'node:child_process';
const env={...process.env,...(process.argv.includes('--offline')?{BACKSTOP_OFFLINE:'true'}:{})};
const children=[spawn('npm',['run','api'],{stdio:'inherit',env}),spawn('npm',['run','dev'],{stdio:'inherit',env})];
let stopping=false;
function stop(code=0){if(stopping)return;stopping=true;for(const p of children)p.kill('SIGTERM');setTimeout(()=>process.exit(code),400);}
for(const p of children)p.on('exit',code=>stop(code??0));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>stop());
