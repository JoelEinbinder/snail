//
//  NodeTalker.h
//  Terminal
//
//  Created by Joel Einbinder on 3/24/22.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface NodeTalker : NSObject {
    NSTask* task;
}
-(instancetype)init;
-(void)sendMessage: (NSDictionary*) message;

@property (nonatomic, copy, nullable) void (^onMessage)(NSString*);

@end

NS_ASSUME_NONNULL_END
