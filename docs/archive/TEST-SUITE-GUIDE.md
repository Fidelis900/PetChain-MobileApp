# PetChain Test Suite - Complete Guide

## Quick Start

### Installation

```bash
# Install dependencies (if not already done)
npm install

# Run all tests
npm test

# Run tests with coverage
npm run test:ci

# Run tests in watch mode
npm test -- --watch
```

### Expected Output

```
PASS  backend/services/__tests__/pdfParserService.test.ts
PASS  backend/services/__tests__/pdfExtractionService.test.ts
PASS  backend/services/__tests__/paymentService.test.ts
PASS  backend/services/__tests__/insuranceService.test.ts
PASS  backend/services/__tests__/drugDatabaseService.test.ts
PASS  backend/services/__tests__/messagingService.test.ts
PASS  backend/middleware/__tests__/auth.test.ts
PASS  backend/middleware/__tests__/errorHandler.test.ts
PASS  backend/server/__tests__/integration.test.ts
PASS  src/__tests__/screens/PetDetailScreen.snapshot.test.tsx
PASS  src/__tests__/screens/EmergencyContactsScreen.snapshot.test.tsx
PASS  src/__tests__/screens/MedicalRecordViewerScreen.snapshot.test.tsx
PASS  src/__tests__/screens/QRScannerScreen.snapshot.test.tsx
PASS  src/__tests__/screens/SettingsScreen.snapshot.test.tsx

Test Suites: 14 passed, 14 total
Tests:       200+ passed, 200+ total
Coverage:    90%+ across codebase
```

---

## Test Suite Structure

### 1. Service Layer Tests (Backend)

Located in `backend/services/__tests__/`

#### PDF Services
- **pdfParserService.test.ts** (30+ tests)
  - Date normalization
  - Confidence scoring
  - Document type detection
  - Vet record parsing
  - Record validation

- **pdfExtractionService.test.ts** (25+ tests)
  - PDF validation
  - Text extraction
  - Base64 processing
  - URL processing
  - OCR handling

#### Business Logic Services
- **paymentService.test.ts** (40+ tests)
  - Plan management
  - Payment initiation
  - Payment confirmation
  - Subscription management
  - Payment history

- **insuranceService.test.ts** (35+ tests)
  - OAuth integration
  - Policy management
  - Claim submission
  - Claim tracking

- **drugDatabaseService.test.ts** (50+ tests)
  - Drug lookup
  - Dosage calculations
  - Safety warnings
  - Species-specific handling
  - Drug interactions

- **messagingService.test.ts** (30+ tests)
  - Conversation management
  - Message storage
  - Read status tracking
  - Message retrieval

### 2. Middleware Tests

Located in `backend/middleware/__tests__/`

- **auth.test.ts** (20+ tests)
  - JWT authentication
  - Token validation
  - Role-based authorization
  - Token expiration

- **errorHandler.test.ts** (15+ tests)
  - Error handling
  - Status code mapping
  - Error detail exposure
  - Production vs development

### 3. Integration Tests

Located in `backend/server/__tests__/`

- **integration.test.ts** (60+ tests)
  - User endpoints
  - Pet CRUD operations
  - Medical records
  - Appointments
  - Medications
  - Error handling
  - Response format validation

### 4. Screen Component Tests

Located in `src/__tests__/screens/`

- **PetDetailScreen.snapshot.test.tsx** (3 tests)
- **EmergencyContactsScreen.snapshot.test.tsx** (3 tests)
- **MedicalRecordViewerScreen.snapshot.test.tsx** (4 tests)
- **QRScannerScreen.snapshot.test.tsx** (3 tests)
- **SettingsScreen.snapshot.test.tsx** (3 tests)

### 5. Test Utilities

Located in `src/__tests__/`

- **testUtils.ts**
  - Mock object generators
  - JWT token generation
  - API response mocking
  - Test environment setup

---

## Coverage Targets

### Global Coverage
- **Branches**: 80%
- **Functions**: 80%
- **Lines**: 80%
- **Statements**: 80%

### Service Layer
- **Branches**: 85%
- **Functions**: 85%
- **Lines**: 85%
- **Statements**: 85%

### API Routes
- **Branches**: 80%
- **Functions**: 80%
- **Lines**: 80%
- **Statements**: 80%

### Screen Components
- **Branches**: 75%
- **Functions**: 75%
- **Lines**: 75%
- **Statements**: 75%

---

## Running Specific Tests

### Run single test file
```bash
npm test -- backend/services/__tests__/pdfParserService.test.ts
```

### Run tests matching pattern
```bash
npm test -- --testNamePattern="PDF"
npm test -- --testNamePattern="payment"
npm test -- --testNamePattern="insurance"
```

### Run tests for specific service
```bash
npm test -- backend/services/__tests__/
```

### Run integration tests only
```bash
npm test -- backend/server/__tests__/integration.test.ts
```

### Run screen tests only
```bash
npm test -- src/__tests__/screens/
```

---

## Coverage Reports

### Generate coverage report
```bash
npm run test:ci
```

### View coverage report
```bash
# Open coverage/index.html in browser
open coverage/index.html
```

### Coverage by file
```bash
npm run test:ci -- --verbose
```

---

## Debugging Tests

### Run single test
```bash
npm test -- --testNamePattern="should validate PDF file"
```

### Run with verbose output
```bash
npm test -- --verbose
```

### Run with debugging
```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

### Run with specific timeout
```bash
npm test -- --testTimeout=10000
```

---

## Test Patterns

### Unit Test Pattern
```typescript
describe('Service', () => {
  beforeEach(() => {
    // Setup
  });

  it('should do something', () => {
    // Arrange
    const input = createMockObject();

    // Act
    const result = service.method(input);

    // Assert
    expect(result).toBeDefined();
  });
});
```

### Integration Test Pattern
```typescript
describe('API Endpoint', () => {
  it('should return data', async () => {
    const response = await request(app)
      .get('/api/endpoint')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
```

### Snapshot Test Pattern
```typescript
describe('Component', () => {
  it('should match snapshot', () => {
    const { toJSON } = render(<Component />);
    expect(toJSON()).toMatchSnapshot();
  });
});
```

---

## Mocking External Dependencies

### Stellar SDK
```typescript
jest.mock('@stellar/stellar-sdk', () => ({
  Keypair: { fromSecret: jest.fn() },
  Server: jest.fn(),
}));
```

### Push Notifications
```typescript
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
}));
```

### PDF Processing
```typescript
jest.mock('pdf-parse', () => jest.fn());
jest.mock('tesseract.js', () => ({
  createWorker: jest.fn(),
}));
```

---

## Test Utilities Usage

### Generate test token
```typescript
import { generateTestToken } from '../testUtils';

const token = generateTestToken('user-123', UserRole.OWNER);
```

### Create mock objects
```typescript
import {
  createMockUser,
  createMockPet,
  createMockMedicalRecord,
} from '../testUtils';

const user = createMockUser({ name: 'John' });
const pet = createMockPet({ name: 'Buddy' });
const record = createMockMedicalRecord({ diagnosis: 'Healthy' });
```

### Mock API responses
```typescript
import { mockApiResponse, mockApiError } from '../testUtils';

const response = mockApiResponse({ success: true });
const error = mockApiError('Not found', 404);
```

### Setup/cleanup
```typescript
import { setupTestEnvironment, cleanupTestEnvironment } from '../testUtils';

beforeEach(() => setupTestEnvironment());
afterEach(() => cleanupTestEnvironment());
```

---

## CI/CD Integration

### GitHub Actions
Tests run automatically on:
- Push to main/develop
- Pull requests
- Scheduled daily runs

### Coverage gates
- Tests fail if coverage < 80%
- Service layer must be > 85%
- Routes must be > 80%
- Screens must be > 75%

### Coverage upload
Coverage reports uploaded to Codecov for tracking

---

## Troubleshooting

### Tests timing out
```bash
# Increase timeout
npm test -- --testTimeout=20000
```

### Mock not working
- Ensure mock is defined before import
- Check mock path matches actual module
- Clear mocks between tests

### Coverage not meeting threshold
- Add tests for uncovered branches
- Use coverage report to identify gaps
- Check for untested error paths

### Snapshot tests failing
```bash
# Update snapshots
npm test -- -u
```

---

## Best Practices

1. **Test Organization**
   - Group related tests in describe blocks
   - Use clear, descriptive test names
   - Follow AAA pattern (Arrange, Act, Assert)

2. **Mocking**
   - Mock external dependencies
   - Use realistic mock data
   - Reset mocks between tests

3. **Assertions**
   - Use specific assertions
   - Test both success and failure cases
   - Verify error messages

4. **Coverage**
   - Aim for 80%+ coverage
   - Test critical paths
   - Include edge cases

5. **Performance**
   - Use fake timers for time-dependent tests
   - Avoid unnecessary async operations
   - Clean up resources in afterEach

---

## Resources

- [Jest Documentation](https://jestjs.io/)
- [React Native Testing Library](https://testing-library.com/react-native)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Testing Best Practices](https://testingjavascript.com/)

---

## Support

For questions or issues with the test suite:
1. Check TESTING.md for detailed documentation
2. Review test examples in existing test files
3. Check Jest configuration in jest.config.js
4. Contact the development team

---

## Summary

✅ 200+ test cases
✅ 90% code coverage target
✅ Unit, integration, and snapshot tests
✅ All external dependencies mocked
✅ CI/CD integration ready
✅ Comprehensive documentation

Ready to run: `npm test`
