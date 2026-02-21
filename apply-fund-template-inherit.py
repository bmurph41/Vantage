"""
Fund Template → Equity Auto-Populate
======================================
When user clicks "Apply" on a fund template, auto-populate equity layers
from the template's structure (GP/LP splits, pref return, promote tiers).

Currently applyTemplateMutation just calls the backend endpoint.
We enhance the Fund Inheritance section to show a preview of what
the template will create, and add a "Quick Apply" that pre-fills
the equity form from the template.

Run from workspace root: python3 apply-fund-template-inherit.py
"""

def read(p):
    with open(p) as f: return f.read()
def write(p, c):
    with open(p,'w') as f: f.write(c)

changes = 0
CS = "client/src/pages/modeling/projects/workspace/capital-stack.tsx"
c = read(CS)

# ================================================================
# 1. Enhance Fund Inheritance to show template preview + quick-apply equity
# ================================================================
print("=== 1. Enhance Fund Inheritance with template preview ===")

old_template_actions = """          {/* Fund Template Actions when linked */}
          {dealAllocation && dealAllocation.usesFundCapitalStack && fundTemplates && fundTemplates.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Apply Fund Template</span>
                </div>
                <div className="flex items-center gap-2">
                  <Select onValueChange={setSelectedTemplateId} value={selectedTemplateId || ''}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Select template..." />
                    </SelectTrigger>
                    <SelectContent>
                      {fundTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                          {template.isDefault && ' (Default)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button 
                    size="sm"
                    onClick={() => selectedTemplateId && applyTemplateMutation.mutate(selectedTemplateId)}
                    disabled={!selectedTemplateId || applyTemplateMutation.isPending}
                  >
                    {applyTemplateMutation.isPending ? 'Applying...' : 'Apply'}"""

new_template_actions = """          {/* Fund Template Actions when linked */}
          {dealAllocation && dealAllocation.usesFundCapitalStack && fundTemplates && fundTemplates.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Apply Fund Template</span>
                </div>
                <div className="flex items-center gap-2">
                  <Select onValueChange={setSelectedTemplateId} value={selectedTemplateId || ''}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Select template..." />
                    </SelectTrigger>
                    <SelectContent>
                      {fundTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                          {template.isDefault && ' (Default)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button 
                    size="sm"
                    onClick={() => selectedTemplateId && applyTemplateMutation.mutate(selectedTemplateId)}
                    disabled={!selectedTemplateId || applyTemplateMutation.isPending}
                  >
                    {applyTemplateMutation.isPending ? 'Applying...' : 'Apply'}"""

# The structure above is actually the same — we need to add AFTER the Apply button section
# Let's find the end of the Fund Inheritance card and add a template preview

# Add template preview after the Fund Inheritance Card
old_fund_end = """                  if (defaultTemplate) applyTemplateMutation.mutate(defaultTemplate.id);"""

new_fund_end = """                  if (defaultTemplate) applyTemplateMutation.mutate(defaultTemplate.id);
                  // Also pre-fill equity form from template if it has equity config
                  if (defaultTemplate && (defaultTemplate as any).equityConfig) {
                    const ec = (defaultTemplate as any).equityConfig;
                    if (ec.preferredReturn) equityForm.setValue('preferredReturn', String(ec.preferredReturn));
                    if (ec.gpSplit) {
                      setPromoteTiers([{ irrHurdle: (ec.preferredReturn || 8) / 100, gpSplit: ec.gpSplit / 100, lpSplit: (100 - ec.gpSplit) / 100 }]);
                    }
                  }"""

if old_fund_end in c and 'equityConfig' not in c:
    c = c.replace(old_fund_end, new_fund_end, 1)
    changes += 1
    print("  OK Enhanced template apply to pre-fill equity form")

# ================================================================
# 2. Add template preview section showing what will be created
# ================================================================
print("\n=== 2. Add template preview in Fund Inheritance ===")

# Find the Alert component in the fund link dialog
old_alert = """                      {selectedFundId && (
                        <Alert>
                          <Briefcase className="h-4 w-4" />
                          <AlertTitle>Fund Attribution</AlertTitle>
                          <AlertDescription>
                            This deal's returns will be included in fund-level IRR, TVPI, and DPI calculations.
                            Capital calls and distributions will be tracked at the fund level.
                          </AlertDescription>
                        </Alert>
                      )}"""

new_alert = """                      {selectedFundId && (
                        <Alert>
                          <Briefcase className="h-4 w-4" />
                          <AlertTitle>Fund Attribution</AlertTitle>
                          <AlertDescription>
                            This deal's returns will be included in fund-level IRR, TVPI, and DPI calculations.
                            Capital calls and distributions will be tracked at the fund level.
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* Template Preview */}
                      {selectedTemplateId && fundTemplates && (() => {
                        const tmpl = fundTemplates.find(t => t.id === selectedTemplateId);
                        if (!tmpl) return null;
                        const config = (tmpl as any).config || {};
                        return (
                          <Card className="bg-slate-50 border-dashed">
                            <CardContent className="pt-4">
                              <h5 className="text-sm font-medium mb-2 flex items-center gap-2">
                                <Layers className="h-4 w-4" />
                                Template Preview: {tmpl.name}
                              </h5>
                              <div className="grid grid-cols-2 gap-3 text-xs">
                                {config.targetLtv && (
                                  <div><span className="text-muted-foreground">Target LTV:</span> <span className="font-medium">{config.targetLtv}%</span></div>
                                )}
                                {config.preferredReturn && (
                                  <div><span className="text-muted-foreground">Pref Return:</span> <span className="font-medium">{config.preferredReturn}%</span></div>
                                )}
                                {config.gpSplit && (
                                  <div><span className="text-muted-foreground">GP/LP Split:</span> <span className="font-medium">{config.gpSplit}/{100 - config.gpSplit}</span></div>
                                )}
                                {config.catchUp && (
                                  <div><span className="text-muted-foreground">GP Catch-Up:</span> <span className="font-medium">{config.catchUp}%</span></div>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-2">This structure will be applied to the new capital stack</p>
                            </CardContent>
                          </Card>
                        );
                      })()}"""

if old_alert in c and 'Template Preview' not in c:
    c = c.replace(old_alert, new_alert, 1)
    changes += 1
    print("  OK Added template preview in fund link dialog")

write(CS, c)
print(f"\n=== Fund Template Inheritance: {changes} patches ===")
