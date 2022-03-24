//
//  NodeTalker.m
//  Terminal
//
//  Created by Joel Einbinder on 3/24/22.
//

#import "NodeTalker.h"

@implementation NodeTalker
-(instancetype)init {
    self = [super init];
    NSLog(@"trying");
//    NSTask* task = [NSTask launchedTaskWithExecutableURL:[NSURL fileURLWithPath:@"/usr/local/bin/node"] arguments:@[] error:nil terminationHandler:^(NSTask * _Nonnull task) {
//        NSLog(@"it ended");
//    }];
    task = [[NSTask alloc] init];
    [task setExecutableURL:[NSURL fileURLWithPath:@"/usr/local/bin/node"]];
    [task setArguments:@[@"/Users/joeleinbinder/gap-year/node_host/"]];
    NSPipe* standardOutput = [NSPipe pipe];
    NSPipe* standardInput = [NSPipe pipe];
    NSMutableData* buffer = [[NSMutableData alloc] initWithBytes:NULL length:0];
    [[standardOutput fileHandleForReading] setReadabilityHandler:^(NSFileHandle * _Nonnull file) {
        NSData* data = [file availableData];
        if (![data length])
            return;
        [buffer appendData:data];
        size_t start = 0;
        for (size_t i = 0; i < buffer.length; i++) {
            if (((char*)[buffer bytes])[i] == 0) {
                if (self.onMessage) {
                    self.onMessage([[NSString alloc] initWithData:[buffer subdataWithRange:NSMakeRange(start, i - start)] encoding:NSUTF8StringEncoding]);
                }
                start = i + 1;
            }
        }
        if (start != 0) {
            if (start >= [buffer length])
                [buffer setData:[[NSData alloc] initWithBytes: NULL length:0]];
            else
                [buffer setData:[buffer subdataWithRange:NSMakeRange(start, [buffer length] - start)]];
        }
    }];
    [task setStandardOutput:standardOutput];
    [task setStandardInput:standardInput];
    [task setStandardError:[NSFileHandle fileHandleWithStandardError]];
    [task launch];
//    [[standardInput fileHandleForWriting] writeData:[@"{\"id\": 5, \"method\":\"test\"}\0" dataUsingEncoding:NSUTF8StringEncoding]];
//    [standardInput fileHandleForWriting] writeData:(nonnull NSData *)
//    NSLog(@"stdout %@", [task standardOutput]);
    return self;
}
-(void)sendMessage: (NSDictionary*) message {
    NSData* jsonData = [NSJSONSerialization dataWithJSONObject:message options:0 error:nil];
    [[[task standardInput] fileHandleForWriting] writeData:jsonData];
    [[[task standardInput] fileHandleForWriting] writeData:[@"\0" dataUsingEncoding:NSUTF8StringEncoding]];
}

@end
