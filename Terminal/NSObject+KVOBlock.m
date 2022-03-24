

//  NSObject+KVOBlock.m

#import "NSObject+KVOBlock.h"

@implementation NSObject (KVOBlock)

- (void)observeKeyPath:(NSString *)keyPath withBlock:(void (^)(id, NSString *, id))block {
    [self addObserver:self forKeyPath:keyPath
              options:NSKeyValueObservingOptionOld
              context:(__bridge void *)(block)];
}

- (void)unobserveKeyPath:(NSString *)keyPath {

    [self removeObserver:self forKeyPath:keyPath];
}

- (void) observeValueForKeyPath:(NSString*)keyPath ofObject:(id)object change:(NSDictionary*)change context:(void*)context {

    void (^block)(id, NSString *, id) = (__bridge void (^)(id, NSString *, id))context;
    block(self, keyPath, [change objectForKey:NSKeyValueChangeOldKey]);
}

@end
