import { DiscoveryService } from '@golevelup/nestjs-discovery'
import { Test, TestingModule } from '@nestjs/testing'
import { EXPANDABLE_KEY, EXPANDER_KEY } from './expand'
import { ExpandService } from './expand.service'

describe('ExpandService', () => {
  let expandService: ExpandService

  const mockDiscoveryService = {
    providersWithMetaAtKey: jest.fn(),
    methodsAndControllerMethodsWithMetaAtKey: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpandService,
        {
          provide: DiscoveryService,
          useValue: mockDiscoveryService,
        },
      ],
    }).compile()

    expandService = module.get<ExpandService>(ExpandService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(expandService).toBeDefined()
  })

  describe('onModuleInit', () => {
    /*  it('should initialize expanders and handle missing providers', async () => {
      // Mock data for testing
      const mockExpanders = [
        { meta: 'expander1', discoveredClass: { instance: {} } },
        { meta: 'expander2', discoveredClass: { instance: {} } },
      ]
      const mockExpandables = [
        { meta: { target: 'target1' }, discoveredMethod: { methodName: 'method1', parentClass: { name: 'Parent1' } } },
        { meta: { target: 'target2' }, discoveredMethod: { methodName: 'method2', parentClass: { name: 'Parent2' } } },
      ]

      // Mock the discovery service behavior
      mockDiscoveryService.providersWithMetaAtKey.mockResolvedValue(mockExpanders)
      mockDiscoveryService.methodsAndControllerMethodsWithMetaAtKey.mockResolvedValue(mockExpandables)

      // Spy on the logger
      const loggerSpy = jest.spyOn(expandService['logger'], 'error')

      // Call the method being tested
      await expandService.onModuleInit()

      // Assertions
      expect(mockDiscoveryService.providersWithMetaAtKey).toHaveBeenCalledWith('EXPANDER')
      expect(mockDiscoveryService.methodsAndControllerMethodsWithMetaAtKey).toHaveBeenCalledWith('EXPANDABLE')

      mockExpanders.forEach(expander => {
        expect(expandService['expanders'].get(expander.meta)).toBe(expander.discoveredClass.instance)
      })

      expect(loggerSpy).not.toHaveBeenCalled() // No errors should be logged
    })
 */
    it('should handle missing providers and log an error', async () => {
      const mockExpandables = [
        {
          meta: { target: { name: 'MyDTO' } },
          discoveredMethod: { methodName: 'missingMethod', parentClass: { name: 'MyController' } },
        },
      ]

      mockDiscoveryService.providersWithMetaAtKey.mockResolvedValue([])
      mockDiscoveryService.methodsAndControllerMethodsWithMetaAtKey.mockResolvedValue(mockExpandables)

      const loggerSpy = jest.spyOn(expandService['logger'], 'error')

      await expect(() => expandService.onModuleInit()).rejects.toThrow()

      expect(mockDiscoveryService.providersWithMetaAtKey).toHaveBeenCalledWith(EXPANDER_KEY)
      expect(mockDiscoveryService.methodsAndControllerMethodsWithMetaAtKey).toHaveBeenCalledWith(EXPANDABLE_KEY)
      expect(loggerSpy.mock.calls[0][0]).toBe(
        'Error during module initialization: Expand: missing providers with @RegisterExpander for : MyDTO used in MyController.missingMethod'
      )
    })
  })
})
