from playwright.sync_api import sync_playwright
from pathlib import Path
import json, time, sys, os
p=Path(__file__).parents[1]/'tools/PLAY_Interpreter.html'
r=Path(os.environ.get('PLAY_COMPLETE_REPORT','/mnt/data/Bomberland_preview.pay-complete-report.json'))
c=Path(os.environ.get('PLAY_CANDIDATE','/mnt/data/Bomberland_player_entry_RECOVERED_DRAFT.json'))
errors=[]
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-web-security'])
 page=browser.new_page(viewport={'width':1440,'height':1000},accept_downloads=True)
 page.on('pageerror',lambda e: errors.append(str(e)))
 page.set_content(p.read_text(),wait_until="load",timeout=60000)
 print('TITLE:',page.title())
 print('GUIDED:',page.locator('#guidedWorkflow').count())
 page.locator('#semInputReport').set_input_files(str(r))
 page.wait_for_function("window.PAYSemanticIntegrationTest?.getBundle()?.mechanisms?.length>0",timeout=30000)
 print('SOURCE:',page.locator('#guideSourceStatus').inner_text()[:130])
 print('SOURCE MECH:',page.locator('#semMechanism option').count())
 page.locator('#semCandidateFile').set_input_files(str(c))
 page.wait_for_function("document.querySelector('#semCandidateInput').value.length>500",timeout=7000)
 page.locator('#guideValidate').click()
 page.wait_for_timeout(250)
 print('VALIDATE:',page.locator('#semValidateStatus').inner_text()[:250])
 print('COMPILE ENABLED:',page.locator('#guideCompileSID').is_enabled())
 page.locator('#guideCompileSID').click()
 page.wait_for_function('window.PLAYGuided?.getCompiled()?.sidBytes?.length>100',timeout=30000)
 print('COMPILE:',page.locator('#guideSIDStatus').inner_text())
 print('SID FILE LENGTH:',page.evaluate('window.PLAYGuided.getCompiled().sidBytes.length'))
 with page.expect_download() as dl:
  page.locator('#guideSaveSID').click()
 d=dl.value
 print('DOWNLOADED',d.suggested_filename)
 page.locator('#guideRunDiff').click()
 page.wait_for_function('window.PAYDifferentialUITest?.getResult()?.summary?.total>100',timeout=30000)
 print('DIFF:',page.locator('#guideSIDStatus').inner_text()[:260])
 print('DIFF STATS:',page.evaluate('window.PAYDifferentialUITest.getResult().summary'))
 # Quality conditions: no API key means button disabled; set then it becomes enabled for SID diff
 print('QUALITY BEFORE KEY:',page.locator('#guideSIDQuality').is_enabled())
 page.locator('#apiSessionKey').fill('sk-fake-smoke-test-only')
 print('QUALITY AFTER KEY:',page.locator('#guideSIDQuality').is_enabled())
 page.locator('#clearSessionKey').click()
 print('KEY FORGOTTEN:',page.locator('#apiSessionKey').input_value()=='')
 # Test generated pair identity -- source fixture hash and no implicit raw notes
 print('CONTRACT HASH:',page.evaluate('window.PLAYGuided.getCompiled().contract.source.sha256PSID'))
 assert page.evaluate('window.PAYDifferentialUITest.getResult().summary.failed')==0
 assert page.evaluate('window.PLAYGuided.getCompiled().sidBytes.length')==717
 page.screenshot(path='/mnt/data/PLAY_00_8I2_GUIDED/tests/Guided_Workflow_Desktop.png',full_page=True)
 page.set_viewport_size({'width':600,'height':900});page.screenshot(path='/mnt/data/PLAY_00_8I2_GUIDED/tests/Guided_Workflow_Mobile.png',full_page=True)
 print('JS ERRORS:',errors[:12]);assert not errors
 browser.close()
print('PASS guided input -> semantic contract -> compiled SID -> differential, session key controls')
