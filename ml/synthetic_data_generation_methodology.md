# Synthetic Data Generation for Residential Energy Anomaly Detection

## Mathematical Specification and Methodology

**Document Version:** 1.0  
**Project:** Residential Energy Anomaly Detection for Bill Shock Prevention  
**Target:** Post-paid MERALCO Households, Sampaloc, Manila  
**Author:** Ken Ira Lacson, ML Lead  
**Institution:** National University - Manila  
**Date:** 2024  
**Status:** Ready for Implementation

---

## Abstract

This document specifies the mathematical models, parameters, and generation procedures for two synthetic datasets designed to develop and evaluate the Residential Energy Anomaly Detection pipeline. The datasets are generated as raw data conforming to Contract A (IoT readings) and Contract B (OCR bills) specifications, prior to any preprocessing or feature engineering. A baseline dataset provides a minimal-complexity foundation sufficient for validating core pipeline components and baseline models. An advanced dataset introduces multi-scale temporal patterns, load-dependent noise, appliance event signatures, weather coupling, and heterogeneous anomaly types to stress-test advanced models. All random processes are fully specified with deterministic seeding for exact reproducibility.

---

## 1. Introduction

### 1.1 Purpose

The synthetic data generation serves three objectives:

1. **Pipeline validation:** Provide a controlled environment where every component (ingestion, preprocessing, feature engineering, model training, evaluation, inference) can be tested with known ground truth.
2. **Model benchmarking:** Enable rigorous comparison of baseline and advanced models using injected anomalies with precisely known timestamps, types, and magnitudes.
3. **Reproducible research:** Ensure that all experimental results can be reproduced exactly by any researcher with access to this specification and the master seed.

### 1.2 Design Philosophy

The generation follows a baseline-first approach mirroring the project architecture philosophy. The baseline dataset is intentionally simple—deterministic diurnal templates with additive Gaussian noise—sufficient for validating ingestion through baseline models. The advanced dataset is introduced only when the baseline proves insufficient to differentiate model performance, incorporating complexity factors observed in real residential energy data.

### 1.3 Contract Compliance

All generated data conforms to the project's inter-component data contracts:

**Contract A (IoT Readings):**
```
device_id              : string
user_account_id        : string
timestamp              : ISO 8601 UTC, 15-minute grid aligned
avg_wattage            : float, non-negative
reading_interval_minutes : integer, constant 15
```

**Contract B (OCR Bills):**
```
user_account_id        : string
scan_timestamp         : ISO 8601 UTC
meralco_account_number : string
billing_period         : string
total_kwh_consumed     : float
total_bill_php         : float
```

---

## 2. General Design Principles

### 2.1 Realism Requirements

The synthetic data satisfies the following statistical properties observed in real residential energy consumption:

1. **Strong diurnal (24-hour) cycle:** Consumption follows a daily pattern with distinct morning peak, daytime baseline, and evening peak, consistent with human activity schedules.
2. **Weekday/weekend differentiation:** Weekend patterns differ systematically from weekday patterns in both peak timing and magnitude.
3. **Between-household variation:** Different households exhibit different baseline consumption levels, peak timing, and appliance usage signatures, reflecting genuine demographic diversity.
4. **Within-household autocorrelation:** Consecutive readings are not independent; consumption exhibits temporal smoothness with occasional sharp transitions characteristic of appliance cycling.
5. **Stochastic noise:** Additive noise represents unmodeled appliance activations, measurement error, and environmental fluctuations.
6. **Physically bounded values:** Wattage is strictly non-negative with a realistic upper bound based on typical residential circuit capacity (15–30A at 230V).

### 2.2 Structural Requirements

| Requirement | Specification |
|-------------|---------------|
| Time resolution | 15-minute intervals (96 readings per day) |
| Timezone | UTC, timestamps aligned to 15-minute grid |
| Duration | 90 days per household |
| Households (baseline) | 5 |
| Households (advanced) | 10 |
| Output format | Apache Parquet, one file per household |
| Missing data | Realistic gaps according to specified models |
| Anomalies | Injected at known timestamps with ground-truth labels |

### 2.3 Reproducibility

All random processes are seeded deterministically from a master seed (default: 42) using a reproducible scheme:

- Household-level parameters: `seed = master_seed + household_index × 1000`
- Temporal processes per household: `seed = master_seed + household_index × 1000 + day_index`
- Anomaly injection: `seed = master_seed + 9999`

This ensures full reproducibility while maintaining statistical independence between households.

---

## 3. Baseline Dataset: Mathematical Model

### 3.1 Overview

The baseline dataset employs a deterministic diurnal template plus additive Gaussian noise. It is designed to be simple, transparent, and sufficient for validating the basic pipeline: ingestion, preprocessing, feature engineering, and the three baseline models (Persistence, Historical Median by Time-of-Day, Simple Exponential Smoothing). Anomalies are simple magnitude multipliers injected at known timestamps.

### 3.2 Consumption Model

For household $h$ at timestamp $t$, the raw consumption $W_h(t)$ is defined as:

$$W_h(t) = \max\big(0,\; D_h(t) + \epsilon_h(t)\big)$$

where:

- $D_h(t)$ is the deterministic diurnal template for household $h$
- $\epsilon_h(t) \sim \mathcal{N}(0, \sigma_h^2)$ is Gaussian noise with household-specific variance
- The $\max(0, \cdot)$ operator enforces physical non-negativity

### 3.3 Diurnal Template Formulation

The diurnal template $D_h(t)$ models expected consumption at each 15-minute slot using a sum of Gaussian basis functions, with separate weekday and weekend profiles.

Let $s = \text{slot\_index}(t) \in \{0, 1, \ldots, 95\}$ represent the 15-minute slot within the day, where $s = 0$ corresponds to 00:00–00:15 and $s = 95$ corresponds to 23:45–00:00.

Let $w = \text{is\_weekend}(t) \in \{0, 1\}$ indicate whether timestamp $t$ falls on a weekend.

The diurnal template is defined as:

$$D_h(t) = B_h + \sum_{i=1}^{K_h} A_{h,i} \cdot \exp\left(-\frac{(s - \mu_{h,i})^2}{2\tau_{h,i}^2}\right)$$

where the parameters are defined as follows:

| Parameter | Description | Domain |
|-----------|-------------|--------|
| $B_h$ | Household base load (watts) | $[50, 300]$ |
| $K_h$ | Number of consumption peaks | $3$ to $5$ |
| $A_{h,i}$ | Amplitude of peak $i$ (watts) | $[100, 2000]$ |
| $\mu_{h,i}$ | Center slot of peak $i$ | $[0, 95]$ |
| $\tau_{h,i}$ | Width of peak $i$ (slots) | $[2, 12]$ |

**Peak semantics:** Each Gaussian basis function represents a distinct consumption event—morning routine activities (cooking, showering), midday appliance use, and evening peak demand (lighting, entertainment, air conditioning). The template is computed separately for weekday ($w=0$) and weekend ($w=1$) profiles, with weekend peaks typically shifted 1–2 hours later and exhibiting different amplitudes reflecting altered occupancy patterns.

### 3.4 Baseline Household Configuration

The baseline dataset comprises five households representing a spectrum of occupancy levels and consumption profiles typical of the target demographic in Sampaloc, Manila:

| Household | Profile | $B_h$ (W) | Weekday Peaks | Weekend Peaks | $\sigma_h$ (W) |
|-----------|---------|-----------|---------------|---------------|----------------|
| user_001 | Small apartment, 1–2 occupants | 80 | Morning (06:00, $A=400$, $\tau=4$), Evening (19:00, $A=600$, $\tau=5$) | Morning (08:00, $A=300$, $\tau=4$), Evening (20:00, $A=500$, $\tau=5$) | 30 |
| user_002 | Small apartment, 2–3 occupants | 120 | Morning (06:30, $A=500$, $\tau=3$), Noon (12:00, $A=300$, $\tau=2$), Evening (18:30, $A=800$, $\tau=4$) | Morning (09:00, $A=400$, $\tau=3$), Evening (19:00, $A=700$, $\tau=5$) | 40 |
| user_003 | Medium household, 3–4 occupants | 150 | Morning (05:30, $A=700$, $\tau=3$), Noon (11:30, $A=400$, $\tau=2$), Evening (19:30, $A=1200$, $\tau=5$) | Morning (07:30, $A=600$, $\tau=4$), Afternoon (14:00, $A=500$, $\tau=3$), Evening (20:00, $A=1100$, $\tau=5$) | 50 |
| user_004 | Medium household, 4–5 occupants | 200 | Morning (05:00, $A=900$, $\tau=4$), Noon (12:00, $A=500$, $\tau=3$), Evening (18:00, $A=1500$, $\tau=6$) | Morning (07:00, $A=700$, $\tau=4$), Noon (13:00, $A=600$, $\tau=3$), Evening (19:00, $A=1400$, $\tau=6$) | 60 |
| user_005 | Larger household, 5+ occupants | 250 | Morning (05:00, $A=1100$, $\tau=4$), Noon (12:30, $A=600$, $\tau=3$), Evening (18:30, $A=1800$, $\tau=6$) | Morning (07:00, $A=900$, $\tau=4$), Noon (13:30, $A=700$, $\tau=3$), Evening (19:30, $A=1700$, $\tau=6$) | 70 |

### 3.5 Anomaly Injection

Anomalies in the baseline dataset are simple multiplicative spikes injected at randomly selected timestamps with known ground-truth labels.

**Injection Procedure:**

1. Randomly select $N_{\text{anom}} = 30$ timestamps per household per 90-day period, with a minimum separation of 6 hours between distinct anomaly start times.
2. At each selected timestamp $t_{\text{anom}}$ and the subsequent two readings (total 3 consecutive intervals = 45 minutes, matching the sustained spike rule specified in the architecture), multiply the original consumption by factor $M$:

   $$W_h^{\text{anom}}(t) = W_h(t) \times M$$

   where $M \in \{2.0, 2.5, 3.0\}$ with equal probability.

3. Record anomaly metadata: `(household, start_timestamp, multiplier, duration=3)`.

**Rationale:** Simple magnitude multipliers are directly interpretable and test whether the anomaly detection decision rule ($r_t > k \cdot \sigma_{\text{residuals}}$, sustained for 3 consecutive readings) triggers appropriately. These anomalies simulate a household inadvertently leaving a high-wattage appliance operating.

### 3.6 Missing Data Model

Missing data is introduced via two mechanisms:

1. **Independent random dropouts:** At each timestamp, independently with probability $p_{\text{gap}} = 0.02$, the reading is omitted.

2. **Contiguous gap blocks:** Five gap sequences of length $L \in \{2, 3, 4\}$ (corresponding to 30, 45, and 60 minutes) are randomly placed per household to simulate transient sensor disconnections or network interruptions.

**Expected missing rate:** Approximately 3–4% of total readings.

---

## 4. Advanced Dataset: Mathematical Model

### 4.1 Overview

The advanced dataset introduces multiple realistic complexity factors that the baseline deliberately omits. It is designed to stress-test the advanced models (Holt-Winters Exponential Smoothing, LightGBM Gradient Boosting, LSTM Encoder-Decoder) and reveal whether they justify their additional complexity over baseline alternatives. The advanced dataset incorporates: multi-scale temporal patterns with fine-grained appliance signatures, load-dependent heteroskedastic noise, stochastic appliance event processes, long-term seasonal trend drift, Philippine holiday effects, ambient temperature coupling, and four distinct anomaly types.

### 4.2 Multi-Scale Consumption Decomposition

The advanced model decomposes household consumption into five additive components:

$$W_h(t) = \max\big(0,\; D_h(t) + T_h(t) + A_h(t) + C_h(t) + \eta_h(t)\big)$$

where each component is defined as follows:

| Component | Symbol | Description |
|-----------|--------|-------------|
| Diurnal template | $D_h(t)$ | Refined daily pattern with 8–12 Gaussian basis functions |
| Long-term trend | $T_h(t)$ | Slow drift over weeks capturing seasonal change and behavioral shift |
| Appliance events | $A_h(t)$ | Stochastic high-frequency transients representing individual appliance cycles |
| Weather coupling | $C_h(t)$ | Consumption modulation by external ambient temperature |
| Heteroskedastic noise | $\eta_h(t)$ | Load-dependent noise whose variance scales with consumption level |

### 4.3 Refined Diurnal Template

The diurnal template for the advanced dataset extends the baseline formulation to use $K_h = 8$ to $12$ Gaussian basis functions per household profile, representing finer-grained appliance usage events:

- **Morning period:** Distinct peaks for kettle usage (short, high-amplitude), shower/water heater (medium width), and cooking activities (extended plateau)
- **Midday period:** Intermittent appliance use with potential air conditioning activation
- **Evening period:** Lighting ramp-up, cooking, entertainment systems, and sustained air conditioning load

Additionally, each household exhibits slight day-to-day variation in peak amplitudes:

$$A_{h,i}^{(d)} = A_{h,i} \cdot (1 + \delta_d), \quad \delta_d \sim \mathcal{N}(0, 0.05^2)$$

where $d$ indexes the calendar day, introducing realistic routine variability without altering the fundamental consumption pattern.

### 4.4 Long-Term Trend Component

The trend component captures gradual consumption evolution over the 90-day simulation period:

$$T_h(t) = S_h \cdot \sin\left(\frac{2\pi t}{P_{\text{seas}}} + \phi_h\right) + R_h \cdot \frac{t}{T_{\text{total}}}$$

where:

| Parameter | Description | Value |
|-----------|-------------|-------|
| $S_h$ | Seasonal amplitude (watts) | $\text{Uniform}[20, 80]$ per household |
| $P_{\text{seas}}$ | Seasonal period | 90 days |
| $\phi_h$ | Phase offset | $\text{Uniform}[0, 2\pi]$ per household |
| $R_h$ | Linear drift rate (watts) | $\text{Uniform}[-30, +30]$ over full period |
| $T_{\text{total}}$ | Total simulation duration | 90 days |

This formulation captures two phenomena: (a) gradual seasonal temperature changes affecting air conditioning demand, modeled by the sinusoidal component, and (b) monotonic behavioral drift such as increased device ownership or conservation efforts, modeled by the linear component.

### 4.5 Appliance Event Component

Individual appliance activations are modeled as transient rectangular pulses with exponential decay, capturing the characteristic inrush current and steady-state draw of common household devices:

$$A_h(t) = \sum_{j} P_{h,j} \cdot \mathbf{1}_{[t_{\text{on},j},\; t_{\text{off},j}]}(t) \cdot \exp\left(-\frac{t - t_{\text{on},j}}{\lambda_{h,j}}\right)$$

where for each event $j$, the parameters are drawn from the following distributions:

| Parameter | Description | Distribution |
|-----------|-------------|--------------|
| $P_{h,j}$ | Peak power draw (high-draw appliances) | $\text{LogNormal}(\mu = \ln(800), \sigma = 0.8)$ |
| $P_{h,j}$ | Peak power draw (low-draw appliances) | $\text{LogNormal}(\mu = \ln(200), \sigma = 0.5)$ |
| $t_{\text{on},j}$ | Activation time | Poisson process with rate $\lambda_{\text{event}}$ |
| Duration | On-time (high-draw) | $\text{Exponential}(\text{mean} = 30 \text{ min})$ |
| Duration | On-time (low-draw) | $\text{Exponential}(\text{mean} = 15 \text{ min})$ |
| $\lambda_{h,j}$ | Decay time constant | Duration / 3 |

**Event rates:** High-draw events (air conditioner compressor, water heater, electric oven) occur at rate $\lambda_{\text{high}} = 0.3$ per hour during waking hours (06:00–22:00). Low-draw events (refrigerator compressor cycling, electronics, lighting transitions) occur at rate $\lambda_{\text{low}} = 1.5$ per hour continuously.

This component introduces the characteristic "spiky" texture of raw energy data that simple Gaussian templates cannot capture. The exponential decay models the physical behavior of motor-driven and compressor-based appliances, which draw elevated starting current that decays to steady-state operating levels.

### 4.6 Weather Coupling Component

Air conditioning load—a primary driver of bill shock in Manila households—is modeled as a linear function of excess temperature above a household-specific comfort threshold:

$$C_h(t) = \alpha_h \cdot \max\big(0,\; T_{\text{ambient}}(t) - T_{\text{threshold},h}\big)$$

where:

| Parameter | Description | Value |
|-----------|-------------|-------|
| $T_{\text{ambient}}(t)$ | External temperature at time $t$ | Generated from Manila temperature model |
| $T_{\text{threshold},h}$ | Temperature threshold for cooling activation | $\text{Uniform}[26, 30]$ °C per household |
| $\alpha_h$ | Cooling sensitivity (watts/°C above threshold) | $\text{Uniform}[50, 200]$ per household |

This formulation reflects the physical reality that cooling demand increases approximately linearly with the temperature excess above the household's comfort setpoint.

### 4.7 Ambient Temperature Model for Manila

Manila's tropical climate (Köppen classification: Am) exhibits distinct diurnal temperature variation but limited seasonal range. The temperature model comprises three additive components:

$$T_{\text{ambient}}(t) = T_{\text{base}} + T_{\text{diurnal}}(t) + T_{\text{weather}}(t)$$

**Base temperature:** $T_{\text{base}} = 27.0$ °C, reflecting Manila's annual mean.

**Diurnal cycle:** Modeled as a sinusoidal oscillation with afternoon peak and pre-dawn trough:

$$T_{\text{diurnal}}(t) = A_T \cdot \sin\left(\frac{2\pi \cdot (\text{hour\_of\_day}(t) - 14)}{24}\right)$$

where $A_T = 4.0$ °C, positioning the daily maximum at approximately 14:00 local time and the minimum at 02:00.

**Weather variability:** A first-order autoregressive process at daily resolution capturing day-to-day temperature persistence:

$$T_{\text{weather}}(d) = 0.7 \cdot T_{\text{weather}}(d-1) + \nu_d, \quad \nu_d \sim \mathcal{N}(0, 1.5^2)$$

where $d$ indexes calendar days. The autoregressive coefficient of 0.7 ensures realistic clustering of warm and cool periods.

**Resulting temperature characteristics:**
- Mean: approximately 27 °C
- Absolute range: approximately 21–35 °C
- Mean daily range: 6–8 °C
- Day-to-day autocorrelation: approximately 0.7

### 4.8 Heteroskedastic Noise Model

In contrast to the baseline dataset's constant-variance noise, the advanced dataset employs load-dependent noise variance reflecting the physical principle that periods of higher consumption exhibit proportionally larger absolute fluctuations:

$$\eta_h(t) \sim \mathcal{N}\big(0,\; \sigma_{h,0}^2 + \sigma_{h,\text{scale}}^2 \cdot D_h(t)^2\big)$$

where $\sigma_{h,0} = 20$ watts represents the baseline noise floor (measurement error, minimal background fluctuation) and $\sigma_{h,\text{scale}} = 0.05$ controls the proportional scaling with consumption level. At a consumption level of 1000 watts, this yields total noise standard deviation of approximately $\sqrt{20^2 + (0.05 \cdot 1000)^2} \approx 54$ watts.

### 4.9 Advanced Household Configuration

The advanced dataset expands to 10 households stratified into three consumption groups to enable analysis of model performance across demographic segments—a critical fairness consideration for a system targeting economically vulnerable populations:

| Group | Households | $B_h$ (W) | Occupancy | AC Usage | $\alpha_h$ (W/°C) |
|-------|-----------|-----------|-----------|----------|-------------------|
| Low baseline | user_101, user_102 | $[60, 100]$ | 1–2 | None | $0$ |
| Medium baseline | user_103–user_107 | $[120, 200]$ | 2–4 | Moderate | $[50, 120]$ |
| High baseline | user_108–user_110 | $[220, 300]$ | 4–6 | Heavy | $[130, 200]$ |

### 4.10 Anomaly Injection: Four-Type Taxonomy

The advanced dataset introduces four distinct anomaly types to evaluate whether detection models generalize beyond simple magnitude spikes:

#### Type 1: Sustained Over-Consumption Spike (30% of anomalies)

Identical to the baseline anomaly: multiplicative factor $M \in \{2.0, 2.5, 3.0\}$ applied for 3 consecutive readings (45 minutes).

**Simulated scenario:** Appliance inadvertently left operating (air conditioner, electric iron, water pump).

#### Type 2: Gradual Baseline Drift (25% of anomalies)

Consumption increases linearly over a 12-hour ramp period, persists at the elevated level for 24 hours, then returns to normal:

$$W_h^{\text{anom}}(t) = W_h(t) + \Delta \cdot \min\left(1, \frac{t - t_{\text{start}}}{12\text{h}}\right)$$

for $t \in [t_{\text{start}}, t_{\text{start}} + 36\text{h}]$, where $\Delta \sim \text{Uniform}(300, 800)$ watts.

**Simulated scenario:** Malfunctioning appliance with progressive degradation (refrigerator compressor seizing, water leak causing continuous pump cycling).

#### Type 3: Off-Peak Anomaly (25% of anomalies)

Elevated consumption during normally quiescent hours (00:00–05:00), with multiplier $M \in [2.5, 3.5]$ sustained for 6 consecutive readings (1.5 hours).

**Simulated scenario:** Unusual nighttime activity—visitors, illness requiring extended appliance use, or appliance accidentally left running overnight.

#### Type 4: Missing Expected Reduction (20% of anomalies)

Consumption fails to decrease during a period when the diurnal template predicts a trough. The trough is "filled in" to 70% of the surrounding peak level for a 4-hour window:

$$W_h^{\text{anom}}(t) = \max\big(W_h(t),\; 0.7 \cdot \max_{\text{window}} D_h(t)\big)$$

**Simulated scenario:** Occupant present during normally vacant period (public holiday, sick leave), maintaining elevated consumption through what would typically be a low-usage interval.

**Total anomalies:** 40 per household per 90-day period, comprising 10 of each type, with minimum 4-hour separation between distinct anomaly start times.

### 4.11 Advanced Missing Data Model

The advanced missing data model introduces three mechanisms capturing realistic sensor behavior:

**1. Correlated burst dropouts:**

Dropout probability increases following an existing dropout, modeling persistent connectivity issues:

$$P(\text{gap at } t \mid \text{gap at } t-1) = 0.4$$
$$P(\text{gap at } t \mid \text{no gap at } t-1) = 0.01$$

This produces runs of consecutive missing readings consistent with real sensor communication failures.

**2. Sensor degradation events:**

Once per household per 90-day period, a 6–12 hour interval during which readings are present but exhibit exaggerated noise ($\sigma \times 5$). These events are recorded in a separate `sensor_issue_ground_truth` metadata file and are not considered anomalies for model evaluation purposes.

**3. Zero-reading periods:**

Once per household, a 1–3 hour interval of zero readings simulating either a genuine power outage or complete sensor disconnection. These are distinguished from legitimate low-consumption periods via a separate metadata flag.

**Expected total missing rate:** 5–7% of readings, with burst behavior confirmed by runs testing.

### 4.12 Philippine Holiday Integration

Philippine public holidays are integrated via a static reference file (`data/external/philippine_holidays.csv`). On holiday dates:

1. The diurnal template uses the weekend profile regardless of the actual day of week, reflecting altered occupancy patterns.
2. A holiday bonus factor $f_{\text{holiday}} \sim \text{Uniform}(1.05, 1.20)$ multiplies the template amplitude, capturing increased home occupancy and associated consumption.

This provides ground truth for evaluating whether the `is_philippine_holiday` feature in the advanced feature set contributes predictive value beyond calendar features alone.

---

## 5. OCR Bill Data Generation

### 5.1 Bill Calculation Methodology

For each household and each calendar month within the simulation period, the OCR bill record is computed from the underlying consumption data:

$$\text{total\_kwh} = \frac{1}{1000} \sum_{t \in \text{month}} W_h(t) \cdot \frac{15}{60} + \delta_{\text{bill}}$$

where $\delta_{\text{bill}} \sim \mathcal{N}\big(0, (0.02 \cdot \text{total\_kwh})^2\big)$ represents minor meter reading discrepancies between the IoT sensor and the utility meter.

The bill amount in Philippine Pesos is calculated using a simplified residential rate:

$$\text{total\_bill\_php} = \text{total\_kwh} \times 11.50$$

where 11.50 PHP/kWh approximates the effective MERALCO residential rate including generation, transmission, distribution, and system loss charges as of 2024.

### 5.2 Bill Record Schema

One record per household per calendar month:

| Field | Description |
|-------|-------------|
| `user_account_id` | Matches household identifier |
| `scan_timestamp` | First day of following month, 09:00 UTC |
| `meralco_account_number` | Unique 10-digit identifier per household |
| `billing_period` | String formatted as "Month YYYY" |
| `total_kwh_consumed` | Float, 2 decimal places |
| `total_bill_php` | Float, 2 decimal places |

---

## 6. Output Specification

### 6.1 Directory Structure

```
data/synthetic/
├── baseline/
│   ├── raw/
│   │   ├── meter_manila_001.parquet
│   │   ├── meter_manila_002.parquet
│   │   ├── meter_manila_003.parquet
│   │   ├── meter_manila_004.parquet
│   │   ├── meter_manila_005.parquet
│   │   └── ocr_bills.parquet
│   ├── metadata/
│   │   ├── anomaly_ground_truth.parquet
│   │   ├── household_profiles.json
│   │   └── generation_log.json
│   └── README.md
│
├── advanced/
│   ├── raw/
│   │   ├── meter_manila_101.parquet
│   │   ├── meter_manila_102.parquet
│   │   ├── meter_manila_103.parquet
│   │   ├── meter_manila_104.parquet
│   │   ├── meter_manila_105.parquet
│   │   ├── meter_manila_106.parquet
│   │   ├── meter_manila_107.parquet
│   │   ├── meter_manila_108.parquet
│   │   ├── meter_manila_109.parquet
│   │   ├── meter_manila_110.parquet
│   │   └── ocr_bills.parquet
│   ├── metadata/
│   │   ├── anomaly_ground_truth.parquet
│   │   ├── sensor_issue_ground_truth.parquet
│   │   ├── holiday_schedule.parquet
│   │   ├── temperature_manila.parquet
│   │   ├── household_profiles.json
│   │   └── generation_log.json
│   └── README.md
```

### 6.2 Column Schemas

**IoT readings (per household Parquet file):**

| Column | Data Type | Description | Constraints |
|--------|-----------|-------------|-------------|
| device_id | string | Device identifier | Format: `meter_manila_NNN` |
| user_account_id | string | User identifier | Format: `user_NNN` |
| timestamp | datetime64[ns, UTC] | Reading timestamp | 15-minute grid aligned |
| avg_wattage | float64 | Average wattage over interval | Non-negative |
| reading_interval_minutes | int16 | Interval duration | Constant value: 15 |

**Anomaly ground truth (baseline and advanced):**

| Column | Data Type | Description |
|--------|-----------|-------------|
| anomaly_id | string | Unique identifier |
| device_id | string | Device identifier |
| user_account_id | string | User identifier |
| start_timestamp | datetime64[ns, UTC] | First anomalous reading |
| end_timestamp | datetime64[ns, UTC] | Last anomalous reading |
| anomaly_type | string | One of: `MULTIPLICATIVE_SPIKE`, `BASELINE_DRIFT`, `OFF_PEAK`, `MISSING_REDUCTION` |
| multiplier | float64 | Multiplier value (SPIKE and OFF_PEAK types); NaN otherwise |
| delta_watts | float64 | Additive drift magnitude (DRIFT type); NaN otherwise |

**Sensor issue ground truth (advanced only):**

| Column | Data Type | Description |
|--------|-----------|-------------|
| issue_id | string | Unique identifier |
| device_id | string | Device identifier |
| start_timestamp | datetime64[ns, UTC] | Issue onset |
| end_timestamp | datetime64[ns, UTC] | Issue resolution |
| issue_type | string | One of: `SENSOR_DEGRADATION`, `ZERO_READING_PERIOD` |

**OCR bills:**

| Column | Data Type | Description |
|--------|-----------|-------------|
| user_account_id | string | User identifier |
| scan_timestamp | datetime64[ns, UTC] | Bill scan timestamp |
| meralco_account_number | string | 10-digit account number |
| billing_period | string | "Month YYYY" format |
| total_kwh_consumed | float64 | Monthly consumption in kWh |
| total_bill_php | float64 | Bill amount in Philippine Pesos |

### 6.3 Training/Evaluation Split Recommendation

Both datasets provide 90 days of data. The recommended temporal split for model development:

| Partition | Days | Purpose |
|-----------|------|---------|
| Training | 1–60 | Model fitting and hyperparameter selection |
| Validation | 61–76 | Threshold tuning and model selection |
| Test | 77–90 | Final evaluation, reported metrics |

The anomaly ground truth covers the full 90-day period. Filter to the appropriate partition during evaluation to prevent data leakage.

---

## 7. Validation Criteria

Before either dataset is accepted for pipeline integration, it must satisfy the following validation checks:

### 7.1 Structural Integrity

- [ ] All timestamps are aligned to exact 15-minute grid (minutes ∈ {0, 15, 30, 45})
- [ ] No duplicate `(device_id, timestamp)` pairs exist
- [ ] All `avg_wattage` values are non-negative
- [ ] All `reading_interval_minutes` equal 15
- [ ] Anomaly metadata timestamps correspond exactly to injected positions
- [ ] `device_id` and `user_account_id` are consistent within each file

### 7.2 Baseline Dataset Validation

- [ ] Per-household daily mean consumption is within 20% of the household profile's expected value
- [ ] Day-night consumption ratio (mean 06:00–18:00 / mean 18:00–06:00) falls within [0.8, 1.5]
- [ ] Weekday/weekend mean ratio falls within [0.85, 1.15]
- [ ] Missing data rate is 3–4% (±0.5 percentage points)

### 7.3 Advanced Dataset Validation

- [ ] Temperature-consumption Pearson correlation for AC-using households ($\alpha_h > 0$) exceeds 0.3
- [ ] Variance is higher during peak hours than off-peak hours (heteroskedasticity confirmed via Levene's test, $p < 0.05$)
- [ ] Anomaly type distribution matches specification (±2 counts per type per household)
- [ ] Long-term trend component is detectable: linear regression of daily means yields $|R^2|$ consistent with the specified $R_h$
- [ ] Missing data exhibits burst behavior: distribution of consecutive gap lengths differs significantly from geometric distribution expected under independence (chi-square test, $p < 0.05$)
- [ ] Holiday dates exhibit consumption profiles consistent with weekend template (Kolmogorov-Smirnov test against weekend distribution, $p > 0.10$)

### 7.4 Contract Compliance

- [ ] Every row contains all five required IoT columns with correct data types
- [ ] Timestamps conform to ISO 8601 UTC format
- [ ] OCR bill totals match computed consumption-based totals within 5% relative error
- [ ] Parquet files are readable by pandas `read_parquet()` without schema inference errors

---

## 8. Usage Guidelines

### 8.1 Recommended Workflow

1. **Begin with the baseline dataset.** It is sufficient for developing and validating the ingestion stage, preprocessing stage, baseline feature engineering, and all three baseline models (Persistence, Historical Median, Simple Exponential Smoothing). Establish the full pipeline on this simpler foundation before introducing complexity.

2. **Transition to the advanced dataset** when the baseline pipeline is stable and the baseline models have been evaluated. The advanced dataset is required to meaningfully evaluate the advanced models (Holt-Winters, LightGBM, LSTM) and advanced preprocessing techniques (Isolation Forest filtering, median smoothing), as the baseline dataset lacks the complexity that would reveal these techniques' value.

3. **Use anomaly ground truth exclusively for evaluation.** The ground truth metadata files must not be accessible to the training pipeline. They serve solely for computing precision, recall, and F1 scores during the evaluation stage.

4. **The sensor issue ground truth** (advanced dataset) validates the data quality scoring in preprocessing. It should inform quality flag development but must not be used as a model feature.

### 8.2 Reproducibility Guarantee

Given the master seed value (42) and strict adherence to this specification, any conforming implementation must produce bit-identical output. Reproducibility can be verified by comparing MD5 or SHA-256 checksums of the generated Parquet files.

### 8.3 Limitations

1. **Synthetic anomaly limitations:** Injected anomalies assume pure magnitude or temporal signature deviations. Real anomalies may involve complex waveform changes (e.g., malfunctioning appliances with altered duty cycles) not captured by the four-type taxonomy. Empirical precision/recall must be re-evaluated after pilot deployment using user-confirmed anomalies.

2. **Manila specificity:** The temperature model and holiday calendar are specific to Metro Manila. Adaptation to other Philippine regions or international contexts requires recalibrating climate parameters and holiday schedules.

3. **Occupancy assumptions:** The diurnal templates assume conventional occupancy patterns (absent during weekday working hours, present evenings and weekends). Households with shift workers, home-based businesses, or extended family structures may exhibit fundamentally different patterns.

---

## 9. Conclusion

This document provides the complete mathematical specification for two synthetic datasets supporting the development and rigorous evaluation of the Residential Energy Anomaly Detection pipeline. The baseline dataset establishes a minimal-complexity foundation for core pipeline validation. The advanced dataset introduces realistic complexity factors—multi-scale temporal patterns, appliance event processes, weather coupling, heteroskedastic noise, and a four-type anomaly taxonomy—to enable meaningful differentiation between baseline and advanced modeling approaches.

All parameters, distributions, and random processes are fully specified with deterministic seeding, ensuring exact reproducibility. The validation criteria in Section 7 provide objective acceptance tests that any implementation must satisfy before the datasets are admitted to the machine learning pipeline.

---

## References

1. MERALCO. (2024). *Residential Rate Schedules*. Manila Electric Company.
2. Republic Act No. 10173. (2012). *Data Privacy Act of 2012*. Republic of the Philippines.
3. United Nations. (2015). *Sustainable Development Goal 7: Affordable and Clean Energy*.
4. Philippine Atmospheric, Geophysical and Astronomical Services Administration. (2024). *Climate Data for Metro Manila*. PAGASA.
5. Hyndman, R. J., & Athanasopoulos, G. (2021). *Forecasting: Principles and Practice* (3rd ed.). OTexts.




