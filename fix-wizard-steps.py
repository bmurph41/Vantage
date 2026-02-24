#!/usr/bin/env python3
"""
Phase 2 Session 3 — OnboardingWizard asset-class-aware steps fix
Run from project root: python3 fix-wizard-steps.py

Makes the wizard skip marina-specific steps (Profit Centers, Amenities, Storage)
for non-marina asset classes. Uses step titles instead of ordinal numbers.
"""
import sys

FILEPATH = 'client/src/components/onboarding/OnboardingWizard.tsx'

with open(FILEPATH, 'r') as f:
    content = f.read()

changes = 0

# =============================================================================
# 1. Replace hardcoded newProjectSteps with a function
# =============================================================================
old_steps = """const newProjectSteps = [
  { id: 1, title: "Deal Structure", icon: Layers },
  { id: 2, title: "Marina Details", icon: Anchor },
  { id: 3, title: "Deal Info", icon: Target },
  { id: 4, title: "Profit Centers", icon: Store },
  { id: 5, title: "Amenities", icon: ClipboardList },
  { id: 6, title: "Storage", icon: Warehouse },
  { id: 7, title: "Documents", icon: Upload },
];"""

new_steps = """// Marina-only steps that get filtered out for other asset classes
const MARINA_ONLY_STEPS = new Set(["Profit Centers", "Amenities", "Storage"]);

function getNewProjectSteps(assetClass: string | null) {
  const allSteps = [
    { title: "Deal Structure", icon: Layers },
    { title: "Property Details", icon: Anchor },
    { title: "Deal Info", icon: Target },
    { title: "Profit Centers", icon: Store },
    { title: "Amenities", icon: ClipboardList },
    { title: "Storage", icon: Warehouse },
    { title: "Documents", icon: Upload },
  ];
  const filtered = assetClass && assetClass !== 'marina'
    ? allSteps.filter(s => !MARINA_ONLY_STEPS.has(s.title))
    : allSteps;
  return filtered.map((s, i) => ({ ...s, id: i + 1 }));
}

// Keep a static reference for the default (used before asset class is selected)
const newProjectSteps = getNewProjectSteps(null);"""

if old_steps in content:
    content = content.replace(old_steps, new_steps)
    changes += 1
    print("✅ 1. newProjectSteps → dynamic function")
else:
    print("❌ 1. Could not find newProjectSteps block")
    sys.exit(1)

# =============================================================================
# 2. Replace hardcoded onboardingSteps similarly
# =============================================================================
old_onboarding = """const onboardingSteps = [
  { id: 1, title: "Welcome", icon: Sparkles },
  { id: 2, title: "Deal Structure", icon: Layers },
  { id: 3, title: "Marina Details", icon: Anchor },
  { id: 4, title: "Deal Type", icon: Target },
  { id: 5, title: "Profit Centers", icon: Store },
  { id: 6, title: "Amenities", icon: ClipboardList },
  { id: 7, title: "Storage", icon: Warehouse },
  { id: 8, title: "Documents", icon: Upload },
  { id: 9, title: "Features", icon: Sparkles },
  { id: 10, title: "Get Started", icon: Check },
];"""

new_onboarding = """function getOnboardingSteps(assetClass: string | null) {
  const allSteps = [
    { title: "Welcome", icon: Sparkles },
    { title: "Deal Structure", icon: Layers },
    { title: "Property Details", icon: Anchor },
    { title: "Deal Type", icon: Target },
    { title: "Profit Centers", icon: Store },
    { title: "Amenities", icon: ClipboardList },
    { title: "Storage", icon: Warehouse },
    { title: "Documents", icon: Upload },
    { title: "Features", icon: Sparkles },
    { title: "Get Started", icon: Check },
  ];
  const filtered = assetClass && assetClass !== 'marina'
    ? allSteps.filter(s => !MARINA_ONLY_STEPS.has(s.title))
    : allSteps;
  return filtered.map((s, i) => ({ ...s, id: i + 1 }));
}

const onboardingSteps = getOnboardingSteps(null);"""

if old_onboarding in content:
    content = content.replace(old_onboarding, new_onboarding)
    changes += 1
    print("✅ 2. onboardingSteps → dynamic function")
else:
    print("❌ 2. Could not find onboardingSteps block")
    sys.exit(1)

# =============================================================================
# 3. Make `steps` reactive to asset class selection
# =============================================================================
old_steps_ref = """  const steps = mode === "new_project" ? newProjectSteps : onboardingSteps;
  const totalSteps = steps.length;"""

new_steps_ref = """  const steps = useMemo(() => 
    mode === "new_project" 
      ? getNewProjectSteps(state.assetClass) 
      : getOnboardingSteps(state.assetClass),
    [mode, state.assetClass]
  );
  const totalSteps = steps.length;"""

if old_steps_ref in content:
    content = content.replace(old_steps_ref, new_steps_ref)
    changes += 1
    print("✅ 3. steps now reactive to assetClass")
else:
    print("❌ 3. Could not find steps assignment")
    sys.exit(1)

# Need useMemo import — it's already imported on line 1 so should be fine.

# =============================================================================
# 4. Replace getStepContent() to use titles instead of ordinal numbers
# =============================================================================
old_get_step = """  const getStepContent = () => {
    if (mode === "new_project") {
      return {
        1: renderDealStructureStep(),
        2: renderMarinaDetailsStep(),
        3: renderDealInfoStep(),
        4: renderProfitCentersStep(),
        5: renderAmenitiesStep(),
        6: renderStorageTypesStep(),
        7: renderDocumentUploadStep(),
      }[state.step];
    }
    return {
      1: renderWelcomeStep(),
      2: renderDealStructureStep(),
      3: renderMarinaDetailsStep(),
      4: renderDealTypeStep(),
      5: renderProfitCentersStep(),
      6: renderAmenitiesStep(),
      7: renderStorageTypesStep(),
      8: renderDocumentUploadStep(),
      9: renderFeaturesStep(),
      10: renderGetStartedStep(),
    }[state.step];
  };"""

new_get_step = """  const getStepContent = () => {
    const stepTitle = steps.find(s => s.id === state.step)?.title;
    const contentMap: Record<string, React.ReactNode> = mode === "new_project"
      ? {
          "Deal Structure": renderDealStructureStep(),
          "Property Details": renderMarinaDetailsStep(),
          "Deal Info": renderDealInfoStep(),
          "Profit Centers": renderProfitCentersStep(),
          "Amenities": renderAmenitiesStep(),
          "Storage": renderStorageTypesStep(),
          "Documents": renderDocumentUploadStep(),
        }
      : {
          "Welcome": renderWelcomeStep(),
          "Deal Structure": renderDealStructureStep(),
          "Property Details": renderMarinaDetailsStep(),
          "Deal Type": renderDealTypeStep(),
          "Profit Centers": renderProfitCentersStep(),
          "Amenities": renderAmenitiesStep(),
          "Storage": renderStorageTypesStep(),
          "Documents": renderDocumentUploadStep(),
          "Features": renderFeaturesStep(),
          "Get Started": renderGetStartedStep(),
        };
    return stepTitle ? contentMap[stepTitle] : null;
  };"""

if old_get_step in content:
    content = content.replace(old_get_step, new_get_step)
    changes += 1
    print("✅ 4. getStepContent() now title-based")
else:
    print("❌ 4. Could not find getStepContent block")
    sys.exit(1)

# =============================================================================
# 5. Replace handleNext() validation to use titles instead of step numbers
# =============================================================================
old_handle_next = """      // Validate current step before advancing
      const currentStepId = mode === "new_project" ? state.step : state.step;
      const newProjectStep = mode === "new_project" ? state.step : null;
      
      // Step 1 (new_project): must select deal structure + asset class
      if (newProjectStep === 1) {
        if (!state.dealStructure) {
          toast({ title: "Required", description: "Please select a deal structure.", variant: "destructive" });
          return;
        }
        if (!state.assetClass) {
          toast({ title: "Required", description: "Please select an asset class.", variant: "destructive" });
          return;
        }
      }
      
      // Step 2 (new_project): must have name + city + state
      if (newProjectStep === 2) {
        if (state.dealStructure === "single") {
          if (!state.marinaName.trim()) {
            toast({ title: "Required", description: `Please enter a ${getAssetTerms(state.assetClass).property.toLowerCase()}.`, variant: "destructive" });
            return;
          }
          if (!state.marinaAddress.city.trim() || !state.marinaAddress.state.trim()) {
            toast({ title: "Required", description: "Please enter at least a city and state.", variant: "destructive" });
            return;
          }
        } else if (state.dealStructure === "portfolio") {
          if (!state.portfolioMarinas.some(m => m.name.trim())) {
            toast({ title: "Required", description: "Please add at least one property with a name.", variant: "destructive" });
            return;
          }
        }
      }
      
      // Step 3 (new_project): must select deal type
      if (newProjectStep === 3 && !state.dealType) {
        toast({ title: "Required", description: "Please select a deal type.", variant: "destructive" });
        return;
      }"""

new_handle_next = """      // Validate current step before advancing (by title, not ordinal)
      const currentTitle = steps.find(s => s.id === state.step)?.title;
      
      if (currentTitle === "Deal Structure") {
        if (!state.dealStructure) {
          toast({ title: "Required", description: "Please select a deal structure.", variant: "destructive" });
          return;
        }
        if (mode === "new_project" && !state.assetClass) {
          toast({ title: "Required", description: "Please select an asset class.", variant: "destructive" });
          return;
        }
      }
      
      if (currentTitle === "Property Details") {
        if (state.dealStructure === "single") {
          if (!state.marinaName.trim()) {
            toast({ title: "Required", description: `Please enter a ${getAssetTerms(state.assetClass).property.toLowerCase()}.`, variant: "destructive" });
            return;
          }
          if (!state.marinaAddress.city.trim() || !state.marinaAddress.state.trim()) {
            toast({ title: "Required", description: "Please enter at least a city and state.", variant: "destructive" });
            return;
          }
        } else if (state.dealStructure === "portfolio") {
          if (!state.portfolioMarinas.some(m => m.name.trim())) {
            toast({ title: "Required", description: "Please add at least one property with a name.", variant: "destructive" });
            return;
          }
        }
      }
      
      if ((currentTitle === "Deal Info" || currentTitle === "Deal Type") && !state.dealType) {
        toast({ title: "Required", description: "Please select a deal type.", variant: "destructive" });
        return;
      }"""

if old_handle_next in content:
    content = content.replace(old_handle_next, new_handle_next)
    changes += 1
    print("✅ 5. handleNext() validation now title-based")
else:
    print("❌ 5. Could not find handleNext validation block")
    sys.exit(1)

# =============================================================================
# 6. Guard saveStorageConfig call — only for marina
# =============================================================================
old_save_storage = """      if (projectId) {
        await saveStorageConfig(projectId);
        await uploadStagedFiles(projectId);"""

new_save_storage = """      if (projectId) {
        if (state.assetClass === 'marina') {
          await saveStorageConfig(projectId);
        }
        await uploadStagedFiles(projectId);"""

if old_save_storage in content:
    content = content.replace(old_save_storage, new_save_storage)
    changes += 1
    print("✅ 6. saveStorageConfig guarded to marina-only")
else:
    print("❌ 6. Could not find saveStorageConfig call")

# =============================================================================
# 7. Fix "owned_marina" label in deal info dropdown
# =============================================================================
old_owned = """              <SelectItem value="owned_marina">Owned Marina</SelectItem>"""
new_owned = """              <SelectItem value="owned_marina">Owned Asset</SelectItem>"""

if old_owned in content:
    content = content.replace(old_owned, new_owned)
    changes += 1
    print("✅ 7. 'Owned Marina' → 'Owned Asset' in deal source")
else:
    print("⚠️  7. Could not find 'Owned Marina' select item (may already be fixed)")

# =============================================================================
# 8. Fix "Storage & Spaces" heading to be marina-aware
# =============================================================================
old_storage_heading = """          <h3 className="text-lg font-semibold">Storage & Spaces</h3>
          <p className="text-sm text-muted-foreground">
            What types of boat storage does this marina offer? Add counts and occupancy if known.
          </p>"""

new_storage_heading = """          <h3 className="text-lg font-semibold">Storage & Spaces</h3>
          <p className="text-sm text-muted-foreground">
            What types of storage or spaces does this property offer? Add counts and occupancy if known.
          </p>"""

if old_storage_heading in content:
    content = content.replace(old_storage_heading, new_storage_heading)
    changes += 1
    print("✅ 8. Storage heading genericized")
else:
    print("⚠️  8. Could not find storage heading (may already be fixed)")

# =============================================================================
# 9. Fix portfolio creation toast
# =============================================================================
old_toast = '''          ? `${projectCount} marina${projectCount > 1 ? 's' : ''} added to CRM and Financial Model.`'''
new_toast = '''          ? `${projectCount} asset${projectCount > 1 ? 's' : ''} added to CRM and Financial Model.`'''

if old_toast in content:
    content = content.replace(old_toast, new_toast)
    changes += 1
    print("✅ 9. Portfolio toast genericized")
else:
    print("⚠️  9. Could not find portfolio toast")

# =============================================================================
# 10. Fix "MarinaMatch Setup" title to be generic when not marina
# =============================================================================
old_title = '''{mode === "new_project" ? "New Project" : "MarinaMatch Setup"}'''
new_title = '''{mode === "new_project" ? "New Project" : "Setup Wizard"}'''

if old_title in content:
    content = content.replace(old_title, new_title)
    changes += 1
    print("✅ 10. 'MarinaMatch Setup' → 'Setup Wizard'")
else:
    print("⚠️  10. Could not find MarinaMatch Setup title")

# =============================================================================
# Write
# =============================================================================
with open(FILEPATH, 'w') as f:
    f.write(content)

print(f"\n=== Applied {changes} patches to OnboardingWizard.tsx ===")
