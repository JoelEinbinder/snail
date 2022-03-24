#import <Foundation/Foundation.h>

@interface NSObject (KVOBlock)

// invoke the block when the receiver's value at keyPath changes
// block params are the receiver, the keyPath and the old value
- (void)observeKeyPath:(NSString *)keyPath withBlock:(void (^)(id, NSString *, id))block;
- (void)unobserveKeyPath:(NSString *)keyPath;

@end
