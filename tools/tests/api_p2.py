from api_common import *
def phase(page):
    step('5. stage 2 (data read back from the server): recommend, apply, continue')
    page.goto(BASE + 'index.html?page=sizing&clientId=BS-1001'); page.wait_for_url('**/sizing.html**')
    page.wait_for_function("document.getElementById('loadedFromStage1Banner').innerText.includes('נטענו')")
    page.fill('#rec_roofArea', '120'); page.click('#findSizeBtn')
    page.wait_for_function("document.getElementById('recResults').style.display !== 'none'")
    print('   recommendation: panels', page.inner_text('#rec_pv_kw'), '| battery', page.inner_text('#rec_bat_kwh'))
    page.click('button[onclick*="applyRecommendationToManualFields"]'); page.click('button[onclick*="saveAndContinueToStage3"]'); page.wait_for_url('**/finance.html**')
    h, r = row(); print('   server column 31:', r[h.index('המלצת גודל מערכת (JSON)')][:110])
    step('6. stage 3: calc, save to the customer file, back to the CRM')
    page.wait_for_function("getComputedStyle(document.getElementById('calc_results')).display !== 'none'")
    page.click('#saveToQuoteBtn'); page.wait_for_url('**/crm.html**')
    page.wait_for_function("typeof globalCustomers !== 'undefined' && globalCustomers.length >= 2")
    page.evaluate("selectCustomer('BS-1001')")
    print('   CRM status:', page.inner_text('#stageStatusLine'))
    h, r = row(); raw = r[h.index('נתוני חישוב גולמיים (JSON)')]
    print('   server column 29:', len(raw), 'chars | cols 20-23:', r[19:23])
run(phase)
