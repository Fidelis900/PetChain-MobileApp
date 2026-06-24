# Pet Health Score Algorithm v2

## Overview

The Pet Health Score Algorithm v2 is an advanced health assessment system that provides pet owners with actionable insights into their pet's overall health status. Unlike the v1 rule-based system, v2 incorporates machine learning-derived weights, species-specific baselines, and confidence intervals for more accurate and personalized health scoring.

## Key Features

### 1. Machine Learning-Derived Weights

The algorithm analyzes historical health data across species and breeds to determine optimal feature weights. These weights are updated periodically as more data is collected.

- **Vaccination**: Typically 0.2-0.25 (20-25% of score)
- **Medical History**: 0.15 (15% of score)
- **Preventive Care**: 0.15 (15% of score)
- **Age**: 0.1-0.15 (10-15% of score)
- **Weight**: 0.1 (10% of score)
- **Activity Level**: 0.1 (10% of score)
- **Diet Quality**: 0.08 (8% of score)
- **Dental Health**: 0.05 (5% of score)
- **Mental Wellbeing**: 0.02 (2% of score)

### 2. Species and Breed-Specific Baselines

The algorithm adjusts weights based on species and breed characteristics:

**Canine**:
- Higher weight on vaccination (dogs are more susceptible to certain diseases)
- Considers breed-specific health concerns

**Feline**:
- Adjusted indoor/outdoor living considerations
- Breed-specific genetic predispositions

### 3. Confidence Intervals

Confidence intervals widen with fewer data points and narrow as more health data is collected:

- < 10 data points: ±15 point range
- 10-20 data points: ±10 point range
- 20-50 data points: ±5 point range
- > 50 data points: ±3 point range

### 4. Incremental Score Updates

As new health data arrives, the algorithm efficiently updates the score without requiring full recalculation:

```javascript
const newScore = await healthScoringServiceV2.updateHealthScoreIncremental(
  petId,
  { activityLevel: 85, dietQuality: 80 }
);
```

### 5. Score Explanations

Each score includes:
- Overall score (0-100)
- Confidence interval range
- Individual factor contributions with weights
- Top 3 strengths
- Top 3 areas for improvement

### 6. A/B Testing Support

Compare v1 and v2 algorithms to measure improvement:

```javascript
const comparison = await healthScoringServiceV2.compareAlgorithms(petId);
// {
//   v1Score: 72,
//   v2Score: 78,
//   v2Explanation: { ... },
//   difference: 6,
//   percentageDifference: 8.3
// }
```

## Algorithm Details

### Health Factor Calculations

#### Age Score (0-100)
- **Young (< 2 years)**: 70-90 (growing into prime)
- **Prime (2-7 years)**: 90 (healthiest years)
- **Mature (7-10 years)**: 80 (stable)
- **Senior (> 10 years)**: Declining 5 points per year

#### Vaccination Status (0-100)
- **Up-to-date**: +40 points base
- **Recent vaccine (< 1 year)**: +10 bonus points
- **Base**: 50

#### Medical History (0-100)
- **Start**: 100 points
- **Each chronic condition**: -10 points
- **Each past health issue**: -2 points
- **Minimum**: 20 points

#### Preventive Care (0-100)
- **Base**: 50 points
- **Each annual checkup**: +15 points
- **Maximum**: 100 points

#### Weight Score (0-100)
- **Within 10% of ideal**: 95
- **Within 20% of ideal**: 80
- **Within 30% of ideal**: 60
- **Beyond 30%**: Declining based on difference

#### Activity Level (0-100)
- **High**: 95
- **Moderate**: 85
- **Low**: 60

#### Diet Quality (0-100)
- **Excellent**: 95
- **Good**: 80
- **Fair**: 60
- **Poor**: 30

#### Dental Health (0-100)
- **Healthy**: 90
- **Needs cleaning**: 70
- **Disease**: 40

#### Mental Wellbeing (0-100)
- **Excellent**: 95
- **Good**: 80
- **Stressed**: 50
- **Anxious**: 40

### Score Interpretation

- **80-100**: Excellent health - continue current practices
- **60-79**: Good health - minor improvements possible
- **40-59**: Fair health - significant attention needed
- **0-39**: Poor health - immediate veterinary attention recommended

## Data Requirements

For accurate scoring, the system requires:

1. **Pet Information**
   - Date of birth (for age calculation)
   - Species and breed
   - Ideal weight

2. **Health Metrics** (at least one required)
   - Vaccination status
   - Medical history
   - Recent checkups
   - Current weight
   - Activity level
   - Diet information
   - Dental status

## Migration to v2

### Phase 1: Parallel Scoring (Current)
- Both v1 and v2 scores calculated
- Users can see both for comparison
- Gathering data for A/B testing

### Phase 2: Gradual Rollout
- Default to v2 for new users
- Existing users can opt-in
- Comparing user satisfaction

### Phase 3: Full Migration
- v2 becomes default algorithm
- v1 available for reference only

## Performance Considerations

- Scores cached for 24 hours
- Incremental updates avoid full recalculation
- Database indexes on pet_id and species for quick lookups
- Historical data stored for trend analysis

## Future Enhancements

1. **Deep Learning Integration**: Use neural networks for weight derivation
2. **Breed Database**: Integrate with genetic health databases
3. **Wearable Integration**: Include activity tracker data
4. **Environmental Factors**: Temperature, pollution, climate
5. **Lifestyle Scoring**: Social enrichment, training, behavior
6. **Predictive Modeling**: Forecast health trajectory

## Testing

### Unit Tests
- Individual factor calculations
- Confidence interval computation
- Weight derivation

### Integration Tests
- End-to-end scoring calculation
- v1 vs v2 comparison
- Incremental updates

### A/B Testing
- User satisfaction survey
- Accuracy against veterinary assessment
- Score stability over time

## API Endpoints

### Calculate Score
```
GET /api/health-scoring/v2/pet/:petId
```

### Compare Algorithms
```
GET /api/health-scoring/v2/compare/:petId
```

### Update Score
```
POST /api/health-scoring/v2/update/:petId
Body: { newFactor: { ... } }
```

### Analyze Species Data
```
POST /api/health-scoring/v2/analyze-species
Body: { species: "Canine", breed: "Labrador" }
```

## Glossary

- **Factor**: Individual health metric (e.g., vaccination status, weight)
- **Weight**: Importance multiplier for a factor in the overall score
- **Confidence Interval**: Range around the score accounting for data uncertainty
- **Incremental Update**: Score update using only new data
- **A/B Testing**: Comparing v1 and v2 algorithms on real users

## Support

For questions or issues with health scoring:
- Check our FAQ at petchain.app/health-scoring
- Contact support@petchain.app
- Review recent algorithm updates at petchain.app/algorithms
