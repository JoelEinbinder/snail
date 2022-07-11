//
//  AppDelegate.h
//  Terminal
//
//  Created by Joel Einbinder on 3/23/22.
//

#import <Cocoa/Cocoa.h>

@interface AppDelegate : NSObject <NSApplicationDelegate> {
    NSMutableArray<NSWindow*>* windows;
}

-(IBAction)newWindowButton:(id)sender;
-(IBAction)newWindowForTab:(id)sender;
-(IBAction)newTab:(id)sender;
@end

