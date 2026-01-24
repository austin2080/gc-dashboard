"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";

type FormState = { error?: string };

type ProjectDefaults = {
  id: string;
  name: string;
  project_number: string | null;
  city: string | null;
  health: "on_track" | "at_risk" | "on_hold" | "complete";
  start_date: string | null;
  end_date: string | null;
  contracted_value: number | null;
  estimated_profit: number | null;
  estimated_buyout: number | null;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      className="rounded border border-black bg-black px-4 py-2 text-sm text-white disabled:opacity-60"
      disabled={pending}
    >
      {pending ? "Saving..." : "Save Changes"}
    </button>
  );
}

export default function EditProjectForm({
  action,
  project,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  project: ProjectDefaults;
}) {
  const [state, formAction] = useFormState<FormState, FormData>(action, {});
  const formatMoney = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    []
  );

  const [contractedValueDisplay, setContractedValueDisplay] = useState(
    formatMoney.format(project.contracted_value ?? 0)
  );
  const [estimatedProfitDisplay, setEstimatedProfitDisplay] = useState(
    formatMoney.format(project.estimated_profit ?? 0)
  );
  const [estimatedBuyoutDisplay, setEstimatedBuyoutDisplay] = useState(
    formatMoney.format(project.estimated_buyout ?? 0)
  );

  function normalizeMoneyInput(value: string) {
    return value.replace(/[^\d.]/g, "");
  }

  function asNumberString(value: string) {
    const cleaned = normalizeMoneyInput(value);
    return cleaned === "" ? "0" : cleaned;
  }

  function handleMoneyChange(value: string, setDisplay: (next: string) => void) {
    // Allow typing without forcing formatting on each keystroke.
    const cleaned = value.replace(/[^\d.]/g, "");
    setDisplay(cleaned);
  }

  function handleMoneyBlur(value: string, setDisplay: (next: string) => void) {
    const cleaned = normalizeMoneyInput(value);
    const numeric = cleaned === "" ? 0 : Number(cleaned);
    setDisplay(formatMoney.format(Number.isNaN(numeric) ? 0 : numeric));
  }

  return (
    <main className="p-6 space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Edit Project</h1>
          <p className="text-sm opacity-80">Update project details and metrics.</p>
        </div>
        <Link className="border rounded px-3 py-2 text-sm" href={`/projects/${project.id}`}>
          Back to Project
        </Link>
      </header>

      <form action={formAction} className="max-w-3xl space-y-6">
        <section className="border rounded-lg p-4 space-y-4">
          <h2 className="font-semibold">General Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <label className="space-y-1 md:col-span-2">
              <div className="opacity-70">Project Template</div>
              <select
                name="project_template"
                className="w-full rounded border border-black/20 px-3 py-2"
                defaultValue=""
              >
                <option value="" disabled>
                  Select template
                </option>
                <option value="placeholder">Placeholder</option>
              </select>
            </label>
            <label className="space-y-1 md:col-span-2">
              <div className="opacity-70">Stage</div>
              <select
                name="stage"
                className="w-full rounded border border-black/20 px-3 py-2"
                defaultValue=""
              >
                <option value="" disabled>
                  Select stage
                </option>
                <option value="bidding">Bidding</option>
                <option value="close_out">Close-out</option>
                <option value="course_of_construction">Course of construction</option>
                <option value="pre_construction">Pre-construction</option>
                <option value="warranty">Warranty</option>
              </select>
            </label>
            <label className="space-y-1">
              <div className="opacity-70">Project Name</div>
              <input
                name="name"
                required
                defaultValue={project.name}
                className="w-full rounded border border-black/20 px-3 py-2"
              />
            </label>
            <label className="space-y-1">
              <div className="opacity-70">Project Number</div>
              <input
                name="project_number"
                defaultValue={project.project_number ?? ""}
                className="w-full rounded border border-black/20 px-3 py-2"
                placeholder="P-1027"
              />
            </label>
            <label className="space-y-1 md:col-span-2">
              <div className="opacity-70">Description</div>
              <textarea
                name="description"
                className="w-full rounded border border-black/20 px-3 py-2"
                rows={4}
                placeholder="Enter description"
              />
            </label>
            <label className="space-y-1">
              <div className="opacity-70">Work Scope</div>
              <select
                name="work_scope"
                className="w-full rounded border border-black/20 px-3 py-2"
                defaultValue=""
              >
                <option value="" disabled>
                  Select work scope
                </option>
                <option value="new_construction">New Construction</option>
                <option value="renovation_ti">Renovation/TI</option>
                <option value="service">Service</option>
              </select>
            </label>
            <label className="space-y-1">
              <div className="opacity-70">Project Sector</div>
              <select
                name="project_sector"
                className="w-full rounded border border-black/20 px-3 py-2"
                defaultValue=""
              >
                <option value="" disabled>
                  Select project sector
                </option>
                <option value="commercial">Commercial</option>
                <option value="education">Education</option>
                <option value="healthcare">Healthcare</option>
                <option value="industrial">Industrial</option>
                <option value="multi_family">Multi-family</option>
                <option value="office">Office</option>
                <option value="public">Public/Government</option>
                <option value="retail">Retail</option>
                <option value="warehouse">Warehouse/Distribution</option>
                <option value="hospitality">Hospitality</option>
              </select>
            </label>
            <label className="space-y-1 md:col-span-2">
              <div className="opacity-70">Delivery Method</div>
              <select
                name="delivery_method"
                className="w-full rounded border border-black/20 px-3 py-2"
                defaultValue=""
              >
                <option value="" disabled>
                  Select delivery method
                </option>
                <option value="design_bid_build">Design-Bid-Build</option>
                <option value="design_build">Design-Build</option>
                <option value="cmar">Construction Management at Risk (CMAR)</option>
                <option value="cm_agent">Construction Management (Agency)</option>
                <option value="ipd">Integrated Project Delivery (IPD)</option>
                <option value="gmp">GMP (Guaranteed Maximum Price)</option>
                <option value="lump_sum">Lump Sum</option>
                <option value="cost_plus">Cost Plus</option>
                <option value="time_and_materials">Time & Materials</option>
                <option value="idq">IDIQ / JOC</option>
              </select>
            </label>
            <label className="space-y-1">
              <div className="opacity-70">Status</div>
              <select
                name="health"
                className="w-full rounded border border-black/20 px-3 py-2"
                defaultValue={project.health}
              >
                <option value="on_track">Active</option>
                <option value="at_risk">At Risk</option>
                <option value="on_hold">Starting Soon</option>
                <option value="complete">Inactive</option>
              </select>
            </label>
          </div>
        </section>

        <section className="border rounded-lg p-4 space-y-4">
          <h2 className="font-semibold">Logo & Project Photo</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <label className="space-y-1">
              <div className="opacity-70">Logo</div>
              <input type="file" name="logo" className="w-full rounded border border-black/20 px-3 py-2" />
              <div className="text-xs opacity-60">Attach a logo file (placeholder).</div>
            </label>
            <label className="space-y-1">
              <div className="opacity-70">Project Photo</div>
              <input
                type="file"
                name="project_photo"
                className="w-full rounded border border-black/20 px-3 py-2"
              />
              <div className="text-xs opacity-60">Attach a project photo (placeholder).</div>
            </label>
            <label className="space-y-1">
              <div className="opacity-70">Square Footage</div>
              <input
                type="number"
                name="square_footage"
                className="w-full rounded border border-black/20 px-3 py-2"
                placeholder="Enter square footage"
              />
            </label>
            <label className="space-y-1">
              <div className="opacity-70">Total Value</div>
              <input
                type="number"
                name="total_value"
                className="w-full rounded border border-black/20 px-3 py-2"
                placeholder="Enter total value"
              />
            </label>
            <label className="space-y-1">
              <div className="opacity-70">Code</div>
              <input
                name="code"
                className="w-full rounded border border-black/20 px-3 py-2"
                placeholder="Enter code"
              />
            </label>
            <label className="space-y-1">
              <div className="opacity-70">Bid Type</div>
              <select
                name="bid_type"
                className="w-full rounded border border-black/20 px-3 py-2"
                defaultValue=""
              >
                <option value="" disabled>
                  Select bid type
                </option>
                <option value="competitive_bid">Competitive Bid</option>
                <option value="negotiated">Negotiated</option>
              </select>
            </label>
          </div>
        </section>

        <section className="border rounded-lg p-4 space-y-4">
          <h2 className="font-semibold">Key Metrics</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <label className="space-y-1">
              <div className="opacity-70">Contracted Value</div>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-black/60">
                  $
                </span>
                <input
                  type="hidden"
                  name="contracted_value"
                  value={asNumberString(contractedValueDisplay)}
                />
                <input
                  type="text"
                  inputMode="decimal"
                  name="contracted_value_display"
                  value={contractedValueDisplay}
                  onChange={(e) =>
                    handleMoneyChange(e.target.value, setContractedValueDisplay)
                  }
                  onBlur={(e) =>
                    handleMoneyBlur(e.target.value, setContractedValueDisplay)
                  }
                  className="w-full rounded border border-black/20 pl-6 pr-3 py-2"
                  placeholder="0.00"
                />
              </div>
            </label>
            <label className="space-y-1">
              <div className="opacity-70">Est. OH&P</div>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-black/60">
                  $
                </span>
                <input
                  type="hidden"
                  name="estimated_profit"
                  value={asNumberString(estimatedProfitDisplay)}
                />
                <input
                  type="text"
                  inputMode="decimal"
                  name="estimated_profit_display"
                  value={estimatedProfitDisplay}
                  onChange={(e) =>
                    handleMoneyChange(e.target.value, setEstimatedProfitDisplay)
                  }
                  onBlur={(e) =>
                    handleMoneyBlur(e.target.value, setEstimatedProfitDisplay)
                  }
                  className="w-full rounded border border-black/20 pl-6 pr-3 py-2"
                  placeholder="0.00"
                />
              </div>
            </label>
            <label className="space-y-1">
              <div className="opacity-70">Estimated Buyout</div>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-black/60">
                  $
                </span>
                <input
                  type="hidden"
                  name="estimated_buyout"
                  value={asNumberString(estimatedBuyoutDisplay)}
                />
                <input
                  type="text"
                  inputMode="decimal"
                  name="estimated_buyout_display"
                  value={estimatedBuyoutDisplay}
                  onChange={(e) =>
                    handleMoneyChange(e.target.value, setEstimatedBuyoutDisplay)
                  }
                  onBlur={(e) =>
                    handleMoneyBlur(e.target.value, setEstimatedBuyoutDisplay)
                  }
                  className="w-full rounded border border-black/20 pl-6 pr-3 py-2"
                  placeholder="0.00"
                />
              </div>
            </label>
          </div>
        </section>

        <section className="border rounded-lg p-4 space-y-4">
          <h2 className="font-semibold">Dates</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <label className="space-y-1">
              <div className="opacity-70">Start Date</div>
              <input
                type="date"
                name="start_date"
                defaultValue={project.start_date ?? ""}
                className="w-full rounded border border-black/20 px-3 py-2"
              />
            </label>
            <label className="space-y-1">
              <div className="opacity-70">Completion Date</div>
              <input
                type="date"
                name="end_date"
                defaultValue={project.end_date ?? ""}
                className="w-full rounded border border-black/20 px-3 py-2"
              />
            </label>
            <label className="space-y-1">
              <div className="opacity-70">Warranty Start Date</div>
              <input
                type="date"
                name="warranty_start_date"
                className="w-full rounded border border-black/20 px-3 py-2"
              />
            </label>
            <label className="space-y-1">
              <div className="opacity-70">Warranty End Date</div>
              <input
                type="date"
                name="warranty_end_date"
                className="w-full rounded border border-black/20 px-3 py-2"
              />
            </label>
          </div>
        </section>

        <section className="border rounded-lg p-4 space-y-2">
          <h2 className="font-semibold">ERP Integration</h2>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="erp_sync" className="h-4 w-4" />
            <span>ERP-sync this project</span>
          </label>
        </section>

        <section className="border rounded-lg p-4 space-y-2">
          <h2 className="font-semibold">Advanced</h2>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="test_project" className="h-4 w-4" />
            <span>Test Project</span>
          </label>
        </section>

        <section className="border rounded-lg p-4 space-y-4">
          <h2 className="font-semibold">Additional Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <label className="space-y-1 md:col-span-2">
              <div className="opacity-70">Customer</div>
              <select
                name="customer"
                className="w-full rounded border border-black/20 px-3 py-2"
                defaultValue=""
              >
                <option value="" disabled>
                  Select customer
                </option>
                <option value="placeholder">Placeholder</option>
              </select>
            </label>
          </div>
        </section>

        <section className="border rounded-lg p-4 space-y-4">
          <h2 className="font-semibold">Project Location</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <label className="space-y-1 md:col-span-2">
              <div className="opacity-70">Country</div>
              <select
                name="country"
                className="w-full rounded border border-black/20 px-3 py-2"
                defaultValue=""
              >
                <option value="" disabled>
                  Select country
                </option>
                <option value="US">United States</option>
                <option value="CA">Canada</option>
              </select>
            </label>
            <label className="space-y-1 md:col-span-2">
              <div className="opacity-70">Street Address</div>
              <input
                name="street_address"
                className="w-full rounded border border-black/20 px-3 py-2"
                placeholder="Enter street address"
              />
            </label>
            <label className="space-y-1">
              <div className="opacity-70">City</div>
              <input
                name="city"
                defaultValue={project.city ?? ""}
                className="w-full rounded border border-black/20 px-3 py-2"
                placeholder="City"
              />
            </label>
            <label className="space-y-1">
              <div className="opacity-70">State</div>
              <select
                name="state"
                className="w-full rounded border border-black/20 px-3 py-2"
                defaultValue=""
              >
                <option value="" disabled>
                  Select state
                </option>
                <option value="AL">Alabama</option>
                <option value="AK">Alaska</option>
                <option value="AZ">Arizona</option>
                <option value="AR">Arkansas</option>
                <option value="CA">California</option>
                <option value="CO">Colorado</option>
                <option value="CT">Connecticut</option>
                <option value="DE">Delaware</option>
                <option value="FL">Florida</option>
                <option value="GA">Georgia</option>
                <option value="HI">Hawaii</option>
                <option value="ID">Idaho</option>
                <option value="IL">Illinois</option>
                <option value="IN">Indiana</option>
                <option value="IA">Iowa</option>
                <option value="KS">Kansas</option>
                <option value="KY">Kentucky</option>
                <option value="LA">Louisiana</option>
                <option value="ME">Maine</option>
                <option value="MD">Maryland</option>
                <option value="MA">Massachusetts</option>
                <option value="MI">Michigan</option>
                <option value="MN">Minnesota</option>
                <option value="MS">Mississippi</option>
                <option value="MO">Missouri</option>
                <option value="MT">Montana</option>
                <option value="NE">Nebraska</option>
                <option value="NV">Nevada</option>
                <option value="NH">New Hampshire</option>
                <option value="NJ">New Jersey</option>
                <option value="NM">New Mexico</option>
                <option value="NY">New York</option>
                <option value="NC">North Carolina</option>
                <option value="ND">North Dakota</option>
                <option value="OH">Ohio</option>
                <option value="OK">Oklahoma</option>
                <option value="OR">Oregon</option>
                <option value="PA">Pennsylvania</option>
                <option value="RI">Rhode Island</option>
                <option value="SC">South Carolina</option>
                <option value="SD">South Dakota</option>
                <option value="TN">Tennessee</option>
                <option value="TX">Texas</option>
                <option value="UT">Utah</option>
                <option value="VT">Vermont</option>
                <option value="VA">Virginia</option>
                <option value="WA">Washington</option>
                <option value="WV">West Virginia</option>
                <option value="WI">Wisconsin</option>
                <option value="WY">Wyoming</option>
              </select>
            </label>
            <label className="space-y-1">
              <div className="opacity-70">Zip Code</div>
              <input
                name="zip_code"
                className="w-full rounded border border-black/20 px-3 py-2"
                placeholder="Zip code"
              />
            </label>
            <label className="space-y-1 md:col-span-2">
              <div className="opacity-70">Timezone</div>
              <select
                name="timezone"
                className="w-full rounded border border-black/20 px-3 py-2"
                defaultValue=""
              >
                <option value="" disabled>
                  Select timezone
                </option>
                <option value="America/New_York">Eastern Time (US & Canada)</option>
                <option value="America/Chicago">Central Time (US & Canada)</option>
                <option value="America/Denver">Mountain Time (US & Canada)</option>
                <option value="America/Los_Angeles">Pacific Time (US & Canada)</option>
                <option value="America/Anchorage">Alaska Time</option>
                <option value="Pacific/Honolulu">Hawaii Time</option>
              </select>
            </label>
            <label className="space-y-1">
              <div className="opacity-70">Phone</div>
              <input
                name="phone"
                className="w-full rounded border border-black/20 px-3 py-2"
                placeholder="Phone"
              />
            </label>
            <label className="space-y-1">
              <div className="opacity-70">Region</div>
              <select
                name="region"
                className="w-full rounded border border-black/20 px-3 py-2"
                defaultValue=""
              >
                <option value="" disabled>
                  Select region
                </option>
                <option value="northeast">Northeast</option>
                <option value="southeast">Southeast</option>
                <option value="midwest">Midwest</option>
                <option value="southwest">Southwest</option>
                <option value="west">West</option>
              </select>
            </label>
            <label className="space-y-1 md:col-span-2">
              <div className="opacity-70">Office</div>
              <select
                name="office"
                className="w-full rounded border border-black/20 px-3 py-2"
                defaultValue=""
              >
                <option value="" disabled>
                  Select office
                </option>
              </select>
            </label>
          </div>
        </section>

        {state.error ? (
          <div className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700">
            {state.error}
          </div>
        ) : null}

        <div className="flex items-center gap-3">
          <SubmitButton />
          <div className="text-xs opacity-60">Changes apply immediately.</div>
        </div>
      </form>
    </main>
  );
}
