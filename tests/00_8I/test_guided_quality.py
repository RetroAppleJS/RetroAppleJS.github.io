from playwright.sync_api import sync_playwright
from pathlib import Path
import json,sys,os,base64
folder=Path(__file__).parent
p=folder.parent/'tools/PLAY_Interpreter.html'
candidate=Path(os.environ.get('PLAY_CANDIDATE','/mnt/data/Bomberland_player_entry_RECOVERED_DRAFT.json')).read_text()
report=json.loads(Path(os.environ.get('PLAY_COMPLETE_REPORT','/mnt/data/Bomberland_preview.pay-complete-report.json')).read_text())
(folder/'Bomberland_preview.sid').write_bytes(base64.b64decode(report['source']['originalSID']['base64']))
api_calls=[];errors=[]
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1200,'height':850},accept_downloads=True)
 page.on('pageerror',lambda e: errors.append(str(e)))
 page.set_content(p.read_text(),wait_until='load')
 def mock_api(route):
  req=json.loads(route.request.post_data)
  api_calls.append(req)
  if 'PLAY_Quality_Input_v0.8I2' in req.get('input',''):
   answer='Scoped review: partial control states match; audio feature metrics do not prove music intent.'
  else:answer=candidate
  route.fulfill(status=200,content_type='application/json',body=json.dumps({'id':'resp_test_'+str(len(api_calls)),'status':'completed','output':[{'type':'message','content':[{'type':'output_text','text':answer}]}],'usage':{'output_tokens':1200}}))
 page.route('https://api.openai.com/v1/responses',mock_api)
 page.locator('#sidFile').set_input_files(str(folder/'Bomberland_preview.sid'))
 page.wait_for_function('document.querySelector("#runTrace").disabled===false')
 print('NEW SID LOADED:',page.locator('#guideSourceStatus').inner_text()[:100])
 assert page.locator('#guideTrace').is_enabled()
 page.locator('#guideTrace').click()
 page.wait_for_function('window.PAYSemanticIntegrationTest?.getBundle()?.mechanisms?.length>0',timeout=30000)
 print('TRACE:',page.locator('#guideSourceStatus').inner_text()[:140])
 page.locator('#apiSessionKey').fill('sk-fake-test-key')
 page.locator('#guideBriefing').evaluate('(e)=>e.closest("details").open=true')
 page.locator('#guideBriefing').fill('Please focus on the one-time PLAY gate')
 page.locator('#guidePriorReport').set_input_files(str(folder/'prior_quality.json'))
 page.wait_for_function('document.querySelector("#guidePriorState").textContent.includes("Feedback loaded")')
 page.locator('#guideInterpret').click()
 page.wait_for_function('document.querySelector("#semCandidateInput").value.length>500',timeout=30000)
 page.wait_for_function('document.querySelector("#semSaveContract").disabled===false',timeout=30000)
 assert len(api_calls)==1
 assert 'Please focus on the one-time PLAY gate' in api_calls[0]['input'][1]['content']
 assert 'first local repeat uncertain' in api_calls[0]['input'][1]['content']
 print('GPT CONTEXT:',len(api_calls[0]['input'][1]['content']),'bytes, prior report+briefing included')
 assert page.locator('#guideCompileSID').is_enabled()
 page.locator('#guideCompileSID').click()
 page.wait_for_function('window.PLAYGuided?.getCompiled()?.sidBytes?.length>0')
 page.locator('#guideRunDiff').click()
 page.wait_for_function('window.PAYDifferentialUITest.getResult()?.summary.total>300',timeout=30000)
 for id in ['guideSIDOriginalAudio','guideSIDGeneratedAudio','guidePLAYOriginalAudio','guidePLAYGeneratedAudio']:
  page.locator('#'+id).set_input_files(str(folder/('original_audio.wav' if 'Original' in id else 'generated_audio.wav')))
 print('B QUALITY ENABLED:',page.locator('#guidePLAYQuality').is_enabled())
 assert page.locator('#guidePLAYQuality').is_enabled()
 page.locator('#guideSIDNotes').fill('Captures differ in pitch according to my listening')
 page.locator('#guideSIDQuality').click()
 page.wait_for_function('document.querySelector("#guideSIDQualitySave").disabled===false',timeout=30000)
 print('SID REPORT:',page.locator('#guideSIDQualityStatus').inner_text())
 assert len(api_calls)==2
 assert 'PLAY_Quality_Input_v0.8I2' in api_calls[1]['input']
 assert 'difference' not in '' # trivial
 with page.expect_download() as d:
  page.locator('#guideSIDQualitySave').click()
 saved=json.loads(d.value.path().read_text())
 assert 'sk-fake-test-key' not in json.dumps(saved)
 assert saved['source']['audioMeasurements']['comparison']['durationDeltaSeconds']==0
 assert saved['reviewStatus']=='needs_human_validation'
 print('REPORT METRICS:',saved['source']['audioMeasurements']['comparison'])
 page.locator('#guidePLAYQuality').click()
 page.wait_for_function('document.querySelector("#guidePLAYQualitySave").disabled===false',timeout=30000)
 assert len(api_calls)==3
 assert 'PLAY_audio_export_unavailable_in_00_8I' in api_calls[2]['input']
 print('PLAY REPORT:',page.locator('#guidePLAYQualityStatus').inner_text())
 print('KEY PRESERVED:',page.locator('#apiSessionKey').input_value()=='sk-fake-test-key')
 assert page.locator('#apiSessionKey').input_value()=='sk-fake-test-key'
 print('ERRORS:',errors);assert not errors
 browser.close()
print('PASS source SID -> trace -> GPT (mock) -> deterministic compile -> diff -> audio quality (mock)')
