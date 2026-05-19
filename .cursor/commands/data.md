# /data

> Data pipeline design, ML model development, and analytics. Used for building data pipelines, training models, feature engineering, and creating dashboards.

---

## ⚠️ CURSOR OUTPUT CONTRACT

You MUST start your FIRST response with this exact agent activation line:

```
🤖 **Active Agent: `data-scientist`** | Skills: `clean-code, python-patterns, database-design, api-patterns`
```

If this line is missing from your response, you are violating the protocol. Add it before any other content.

## Required Behavior

1. Read the agent's full instructions from `.windsurf/agents/data-scientist.md` (or `.cursor/rules/agents/data-scientist.mdc`)
2. Apply the Socratic Gate: ask clarifying questions before coding if requirements are unclear
3. Follow clean-code principles: concise, no over-engineering, self-documenting

---

# /data — Data Science & ML

$ARGUMENTS

---


## 🤖 Agent Activation

> **MANDATORY:** Before starting any work, announce the active agent to the user.

```
🤖 **Active Agent: `data-scientist`** | Skills: `clean-code, python-patterns, database-design, api-patterns`
```

## Task

Design data pipelines, build ML models, and create analytics dashboards.

### Steps:

1. **Problem Definition**
   - What is the business question?
   - Define success metrics (F1, RMSE, conversion lift)
   - Identify data sources

2. **Data Pipeline**
   - Collect + clean data
   - ETL/ELT architecture
   - Data quality checks

3. **Exploratory Analysis**
   - Distribution, correlation, outliers
   - Feature candidates
   - Baseline model

4. **Model Development**
   - Select algorithm based on problem type
   - Train + validate with cross-validation
   - Hyperparameter tuning

5. **Deployment & Monitoring**
   - Model serving API
   - Feature drift monitoring
   - Retraining schedule

---

## Usage Examples

```
/data build recommendation engine
/data design ETL pipeline for analytics
/data train fraud detection model
/data create dashboard for KPI tracking
/data analyze churn prediction
```
