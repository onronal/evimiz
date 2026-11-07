"""Local Samsung climate adapter. No cloud, security writes or ownership changes."""
import sys,json,datetime,time
from pathlib import Path
import cbor2
from smartthings_local.protocol.auth import CertificateAuth
from smartthings_local.protocol.dtls_session import DtlsCoapSession

ROOT=Path(__file__).resolve().parent
PREFIX='x.com.samsung.da.'
def read(session,path):
    code,body=session.get(path.strip('/').split('/'))
    if code!=69: raise RuntimeError('Klima verisi okunamadı')
    return cbor2.loads(body)
def decode(items):
    resources={item['href']:item.get('rep',{}) for item in items if 'href' in item}
    temp=resources.get('/temperatures/vs/0',{}).get(PREFIX+'items',[])
    temp=next((t for t in temp if t.get(PREFIX+'id')=='0'),{})
    def number(key):
        try:return float(temp[PREFIX+key])
        except (KeyError,ValueError,TypeError):return None
    mode=resources.get('/mode/vs/0',{})
    now=datetime.datetime.now(datetime.timezone.utc).isoformat()
    lo,hi=number('minimum'),number('maximum')
    power=resources.get('/power/vs/0',{}).get(PREFIX+'power')
    return dict(connected=True,name='Samsung WindFree',source='local',temporaryToken=False,
                power=power.lower() if power in ('On','Off') else None,
                mode=str(mode.get('workingMode','')).lower(),modes=[m.lower() for m in mode.get(PREFIX+'supportedModes',[])],
                temperature=number('current'),unit='C',temperatureAt=now,setpoint=number('desired'),
                range=dict(minimum=lo,maximum=hi,step=number('increment') or 1) if lo is not None and hi is not None else None,at=now)
def main():
    command=json.loads(sys.stdin.read() or '{}')
    connection=command.pop('_connection',None)
    if connection is None:
        connection=json.loads((ROOT/'data/samsung-local/connection.json').read_text())
    auth=CertificateAuth.from_files(str(ROOT/'data/samsung-local/client.pem'),str(ROOT/'data/samsung-local/client.key'))
    session=DtlsCoapSession(connection['ip'],49154,auth=auth)
    try:
        session.connect(timeout=8);session.start_reader()
        items=read(session,'/device/0')
        current=decode(items)
        if current['power']!='on' and ('mode' in command or 'setpoint' in command) and command.get('power') is not True:
            raise ValueError('Mod ve sıcaklık ayarı için önce klimayı açın')
        writes=[]
        if 'power' in command:
            if type(command['power']) is not bool:raise ValueError('Geçersiz güç ayarı')
            writes.append(('/power/vs/0',{PREFIX+'power':'On' if command['power'] else 'Off'}))
        if 'mode' in command:
            if command['mode'] not in current['modes']:raise ValueError('Desteklenmeyen mod')
            writes.append(('/mode/vs/0',{PREFIX+'modes':[command['mode'].capitalize()]}))
        if 'setpoint' in command:
            value=command['setpoint'];limits=current['range']
            if type(value) not in (int,float) or not limits or not limits['minimum']<=value<=limits['maximum']:raise ValueError('Geçersiz sıcaklık')
            writes.append(('/temperatures/vs/0',{PREFIX+'items':[{PREFIX+'id':'0',PREFIX+'desired':format(float(value),'g')}]}))
        if command and not writes:raise ValueError('Geçerli bir komut gerekli')
        for path,payload in writes:
            code,_=session.post(path.strip('/').split('/'),cbor2.dumps(payload))
            if code not in (65,68,69):raise RuntimeError('Klima komutu kabul etmedi')
        if writes:
            time.sleep(2)
            for path,_ in writes:
                updated=read(session,path)
                items=[item for item in items if item.get('href')!=path]+[{'href':path,'rep':updated}]
            current=decode(items)
        checks=[current['power']==('on' if command['power'] else 'off')] if 'power' in command else []
        if 'mode' in command:checks.append(current['mode']==command['mode'])
        if 'setpoint' in command:checks.append(current['setpoint']==command['setpoint'])
        current['confirmed']=all(checks)
        print(json.dumps(current))
    finally:session.close()
if __name__=='__main__':
    try:main()
    except Exception:
        print(json.dumps({'error':'Yerel klima bağlantısı veya komut doğrulaması başarısız. Klima Wi-Fi bağlantısını kontrol edin.'}));sys.exit(1)
