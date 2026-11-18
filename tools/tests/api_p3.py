from api_common import *
def phase(page):
    step('7. D1 over the API: a full-row save keeps column 29')
    page.goto(BASE + 'index.html'); page.wait_for_url('**/crm.html**')
    page.wait_for_function("typeof globalCustomers !== 'undefined' && globalCustomers.length >= 2")
    h, r = row(); i29 = h.index('נתוני חישוב גולמיים (JSON)'); before = r[i29]
    page.evaluate("new Promise(res => google.script.run.withSuccessHandler(res).saveCustomerData(JSON.stringify({clientId:'BS-1001', clientName:'דמו: משפחת כהן (עודכן)'})))")
    h, r2 = row(); print('   col29 before/after:', len(before), len(r2[i29]), '| preserved:', before == r2[i29] and len(before) > 0, '| name:', r2[1])
    step('8. Excel export in SERVER mode (POST generateConsumptionExcelReport, base64 over the API)')
    page.goto(BASE + 'index.html?page=consumption&clientId=BS-1001'); page.wait_for_url('**/consumption.html**')
    page.wait_for_function("window._unifiedResult !== undefined")
    with page.expect_download() as dl: page.click('button[onclick*="exportToExcel"]')
    out = W + '/api_export.xlsx'; dl.value.save_as(out); print('   downloaded:', dl.value.suggested_filename, os.path.getsize(out), 'bytes')
    step('9. print page')
    page.goto(BASE + 'index.html?page=print&clientId=BS-1001'); page.wait_for_url('**/print.html**'); page.wait_for_timeout(3500)
    print('   customer name on the quote:', 'דמו: משפחת כהן' in page.inner_text('body'))
run(phase)
