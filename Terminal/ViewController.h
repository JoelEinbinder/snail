//
//  ViewController.h
//  Terminal
//
//  Created by Joel Einbinder on 3/23/22.
//

#import <Cocoa/Cocoa.h>
#import <WebKit/WebKit.h>
#import "NodeTalker.h"
#include "D4WebPanel.h"
@interface _WKInspector
-(void)showConsole;
@end
@interface D4WebView : WKWebView
//-(id)_inspector;
//-(id)connectInspectorFrontendChannel;
@end

@interface ViewController : NSViewController<WKUIDelegate, WKScriptMessageHandler, NSWindowDelegate> {
    D4WebView* webView;
    NodeTalker* nodeTalker;
    D4WebPanel* panel;
    NSView* containerView;
}
-(IBAction)reloadWindow:(id)sender;
@end

